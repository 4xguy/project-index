use std::collections::HashMap;
use std::fmt::{self, Display, Formatter};
use std::error::Error;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use async_trait::async_trait;

extern crate log;

/// User represents a user in the system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: u32,
    pub name: String,
    pub email: String,
    #[serde(skip)]
    password_hash: String,
}

/// UserService trait for user operations
#[async_trait]
pub trait UserService {
    async fn get_user(&self, id: u32) -> Result<Option<User>, UserError>;
    async fn create_user(&self, user: User) -> Result<User, UserError>;
    async fn update_user(&self, user: User) -> Result<User, UserError>;
    async fn delete_user(&self, id: u32) -> Result<(), UserError>;
    async fn list_users(&self) -> Result<Vec<User>, UserError>;
}

/// Application configuration
#[derive(Debug, Deserialize)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,
}

/// Status enumeration for operations
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Pending,
    InProgress,
    Completed,
    Failed,
}

/// Error types for user operations
#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("User not found")]
    NotFound,
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Database error: {0}")]
    Database(#[from] DatabaseError),
    #[error("Authentication error")]
    Authentication,
}

/// Database error types
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Connection failed")]
    ConnectionFailed,
    #[error("Query failed: {0}")]
    QueryFailed(String),
}

/// Constants
pub const DEFAULT_PORT: u16 = 8080;
pub const MAX_USERNAME_LENGTH: usize = 100;
pub const VERSION: &str = "1.0.0";

static mut GLOBAL_COUNTER: u32 = 0;

/// UserServiceImpl provides concrete implementation of UserService
pub struct UserServiceImpl {
    users: RwLock<HashMap<u32, User>>,
    next_id: RwLock<u32>,
}

impl User {
    /// Creates a new user with the given name and email
    pub fn new(name: String, email: String) -> Self {
        Self {
            id: 0,
            name,
            email,
            password_hash: String::new(),
        }
    }

    /// Validates user data
    pub fn validate(&self) -> Result<(), UserError> {
        if self.name.is_empty() {
            return Err(UserError::InvalidInput("Name is required".to_string()));
        }
        
        if self.email.is_empty() {
            return Err(UserError::InvalidInput("Email is required".to_string()));
        }
        
        if !self.email.contains('@') {
            return Err(UserError::InvalidInput("Invalid email format".to_string()));
        }
        
        if self.name.len() > MAX_USERNAME_LENGTH {
            return Err(UserError::InvalidInput("Username too long".to_string()));
        }
        
        Ok(())
    }

    /// Sets the user's password
    pub fn set_password(&mut self, password: &str) {
        self.password_hash = hash_password(password);
    }

    /// Checks if password is correct
    pub fn verify_password(&self, password: &str) -> bool {
        self.password_hash == hash_password(password)
    }

    /// Gets the user's display name
    pub fn display_name(&self) -> &str {
        &self.name
    }
}

impl Display for User {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "User(id: {}, name: {}, email: {})", self.id, self.name, self.email)
    }
}

impl UserServiceImpl {
    /// Creates a new UserService instance
    pub fn new() -> Self {
        Self {
            users: RwLock::new(HashMap::new()),
            next_id: RwLock::new(1),
        }
    }

    /// Gets the next available user ID
    async fn next_user_id(&self) -> u32 {
        let mut next_id = self.next_id.write().await;
        let id = *next_id;
        *next_id += 1;
        id
    }
}

#[async_trait]
impl UserService for UserServiceImpl {
    async fn get_user(&self, id: u32) -> Result<Option<User>, UserError> {
        let users = self.users.read().await;
        Ok(users.get(&id).cloned())
    }

    async fn create_user(&self, mut user: User) -> Result<User, UserError> {
        user.validate()?;
        
        let id = self.next_user_id().await;
        user.id = id;
        
        let mut users = self.users.write().await;
        users.insert(id, user.clone());
        
        Ok(user)
    }

    async fn update_user(&self, user: User) -> Result<User, UserError> {
        user.validate()?;
        
        let mut users = self.users.write().await;
        if users.contains_key(&user.id) {
            users.insert(user.id, user.clone());
            Ok(user)
        } else {
            Err(UserError::NotFound)
        }
    }

    async fn delete_user(&self, id: u32) -> Result<(), UserError> {
        let mut users = self.users.write().await;
        users.remove(&id).ok_or(UserError::NotFound)?;
        Ok(())
    }

    async fn list_users(&self) -> Result<Vec<User>, UserError> {
        let users = self.users.read().await;
        Ok(users.values().cloned().collect())
    }
}

impl Config {
    /// Loads configuration from environment variables
    pub fn from_env() -> Result<Self, Box<dyn Error>> {
        let port = std::env::var("PORT")
            .unwrap_or_else(|_| DEFAULT_PORT.to_string())
            .parse()?;
            
        let database_url = std::env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL environment variable is required")?;
            
        let jwt_secret = std::env::var("JWT_SECRET")
            .map_err(|_| "JWT_SECRET environment variable is required")?;
            
        let max_connections = std::env::var("MAX_CONNECTIONS")
            .unwrap_or_else(|_| default_max_connections().to_string())
            .parse()?;

        Ok(Config {
            port,
            database_url,
            jwt_secret,
            max_connections,
        })
    }

    /// Validates the configuration
    pub fn validate(&self) -> Result<(), Box<dyn Error>> {
        if self.port == 0 {
            return Err("Port must be greater than 0".into());
        }
        
        if self.database_url.is_empty() {
            return Err("Database URL cannot be empty".into());
        }
        
        if self.jwt_secret.len() < 32 {
            return Err("JWT secret must be at least 32 characters".into());
        }
        
        Ok(())
    }
}

impl Status {
    /// Checks if the status represents a completed state
    pub fn is_completed(&self) -> bool {
        matches!(self, Status::Completed | Status::Failed)
    }

    /// Checks if the status represents an active state
    pub fn is_active(&self) -> bool {
        matches!(self, Status::Pending | Status::InProgress)
    }

    /// Returns the status as a string
    pub fn as_str(&self) -> &'static str {
        match self {
            Status::Pending => "pending",
            Status::InProgress => "in_progress",
            Status::Completed => "completed",
            Status::Failed => "failed",
        }
    }
}

impl Display for Status {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// UserManager provides high-level user management operations
pub struct UserManager<T: UserService> {
    service: T,
    cache: RwLock<HashMap<u32, User>>,
}

impl<T: UserService> UserManager<T> {
    /// Creates a new UserManager
    pub fn new(service: T) -> Self {
        Self {
            service,
            cache: RwLock::new(HashMap::new()),
        }
    }

    /// Gets a user with caching
    pub async fn get_user_cached(&self, id: u32) -> Result<Option<User>, UserError> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(user) = cache.get(&id) {
                return Ok(Some(user.clone()));
            }
        }

        // Fetch from service
        if let Some(user) = self.service.get_user(id).await? {
            let mut cache = self.cache.write().await;
            cache.insert(id, user.clone());
            Ok(Some(user))
        } else {
            Ok(None)
        }
    }

    /// Invalidates the cache for a user
    pub async fn invalidate_cache(&self, id: u32) {
        let mut cache = self.cache.write().await;
        cache.remove(&id);
    }

    /// Clears the entire cache
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }
}

/// Authentication module
pub mod auth {
    use super::*;
    
    /// JWT token claims
    #[derive(Debug, Serialize, Deserialize)]
    pub struct Claims {
        pub sub: u32,
        pub exp: usize,
        pub iat: usize,
    }
    
    /// Authenticates a user with email and password
    pub async fn authenticate_user(
        service: &dyn UserService,
        email: &str,
        password: &str,
    ) -> Result<Option<User>, UserError> {
        let users = service.list_users().await?;
        
        for user in users {
            if user.email == email && user.verify_password(password) {
                return Ok(Some(user));
            }
        }
        
        Ok(None)
    }
    
    /// Generates a JWT token for a user
    pub fn generate_token(user_id: u32, secret: &str) -> Result<String, Box<dyn Error>> {
        // Implementation would generate JWT token
        Ok(format!("token_for_user_{}", user_id))
    }
    
    /// Validates a JWT token
    pub fn validate_token(token: &str, secret: &str) -> Result<Claims, Box<dyn Error>> {
        // Implementation would validate JWT token
        Ok(Claims {
            sub: 1,
            exp: 0,
            iat: 0,
        })
    }
}

/// Utility functions
pub mod utils {
    use super::*;
    
    /// Generates a unique ID
    pub fn generate_id() -> u32 {
        unsafe {
            GLOBAL_COUNTER += 1;
            GLOBAL_COUNTER
        }
    }
    
    /// Validates an email address
    pub fn is_valid_email(email: &str) -> bool {
        email.contains('@') && email.contains('.')
    }
    
    /// Formats a user for display
    pub fn format_user(user: &User) -> String {
        format!("{} <{}>", user.name, user.email)
    }
}

// Helper functions
fn default_max_connections() -> u32 {
    100
}

fn hash_password(password: &str) -> String {
    // In a real implementation, this would use a proper hashing algorithm
    format!("hashed_{}", password)
}

// Macros
macro_rules! log_user_action {
    ($action:expr, $user:expr) => {
        log::info!("User action: {} for user {}", $action, $user.id);
    };
}

// Tests
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_user_creation() {
        let service = UserServiceImpl::new();
        let user = User::new("John Doe".to_string(), "john@example.com".to_string());
        
        let created_user = service.create_user(user).await.unwrap();
        assert_eq!(created_user.name, "John Doe");
        assert_eq!(created_user.email, "john@example.com");
        assert!(created_user.id > 0);
    }

    #[test]
    fn test_user_validation() {
        let mut user = User::new("".to_string(), "john@example.com".to_string());
        assert!(user.validate().is_err());
        
        user.name = "John".to_string();
        assert!(user.validate().is_ok());
    }

    #[test]
    fn test_status_methods() {
        assert!(Status::Completed.is_completed());
        assert!(Status::Pending.is_active());
        assert_eq!(Status::InProgress.as_str(), "in_progress");
    }
}

/// Main function for running the application
#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    env_logger::init();
    
    let config = Config::from_env()?;
    config.validate()?;
    
    let service = UserServiceImpl::new();
    let manager = UserManager::new(service);
    
    // Create a sample user
    let user = User::new("Alice".to_string(), "alice@example.com".to_string());
    log_user_action!("create", user);
    
    println!("User management system started on port {}", config.port);
    println!("Version: {}", VERSION);
    
    Ok(())
}