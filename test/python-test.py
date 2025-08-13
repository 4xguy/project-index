"""
Python test file for AST parsing validation
"""

import os
import sys
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class User:
    """User data model with validation"""
    id: int
    name: str
    email: Optional[str] = None
    
    def __post_init__(self):
        """Validate user data after initialization"""
        if self.id < 0:
            raise ValueError("User ID must be positive")
        if not self.name.strip():
            raise ValueError("User name cannot be empty")


class UserService:
    """Service class for user management operations"""
    
    def __init__(self, database_url: str):
        """Initialize user service with database connection
        
        Args:
            database_url: Connection string for database
        """
        self.database_url = database_url
        self._users: Dict[int, User] = {}
        self._next_id = 1
    
    def create_user(self, name: str, email: Optional[str] = None) -> User:
        """Create a new user in the system
        
        Args:
            name: User's full name
            email: Optional email address
            
        Returns:
            Created user instance
            
        Raises:
            ValueError: If name is invalid
        """
        user = User(id=self._next_id, name=name, email=email)
        self._users[user.id] = user
        self._next_id += 1
        return user
    
    def get_user(self, user_id: int) -> Optional[User]:
        """Retrieve user by ID
        
        Args:
            user_id: Unique user identifier
            
        Returns:
            User instance if found, None otherwise
        """
        return self._users.get(user_id)
    
    def list_users(self) -> List[User]:
        """Get all users in the system
        
        Returns:
            List of all user instances
        """
        return list(self._users.values())
    
    def update_user(self, user_id: int, **kwargs) -> Optional[User]:
        """Update user with new information
        
        Args:
            user_id: User to update
            **kwargs: Fields to update
            
        Returns:
            Updated user or None if not found
        """
        user = self.get_user(user_id)
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
        return user
    
    @property
    def user_count(self) -> int:
        """Get total number of users"""
        return len(self._users)
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format
        
        Args:
            email: Email address to validate
            
        Returns:
            True if email is valid
        """
        return "@" in email and "." in email.split("@")[-1]
    
    @classmethod
    def create_test_service(cls) -> 'UserService':
        """Create service instance for testing
        
        Returns:
            UserService configured for testing
        """
        return cls("sqlite:///:memory:")


def create_admin_user(service: UserService) -> User:
    """Create default admin user
    
    Args:
        service: User service instance
        
    Returns:
        Created admin user
    """
    return service.create_user("Administrator", "admin@example.com")


def main():
    """Main application entry point"""
    service = UserService.create_test_service()
    
    # Create some test users
    admin = create_admin_user(service)
    user1 = service.create_user("John Doe", "john@example.com")
    user2 = service.create_user("Jane Smith")
    
    print(f"Created {service.user_count} users:")
    for user in service.list_users():
        print(f"  - {user.name} ({user.email or 'no email'})")


if __name__ == "__main__":
    main()


# Module-level constants
DEFAULT_DATABASE_URL = "sqlite:///users.db"
MAX_USERS = 1000

# Module-level functions
def get_version() -> str:
    """Get application version"""
    return "1.0.0"

# Export list
__all__ = [
    "User",
    "UserService", 
    "create_admin_user",
    "get_version",
    "DEFAULT_DATABASE_URL",
    "MAX_USERS"
]