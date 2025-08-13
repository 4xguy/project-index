import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, memo } from 'react';
import { createContext, useContext, useReducer } from 'react';

// Interface for props
interface UserProps {
  id: number;
  name: string;
  email?: string;
  onUpdate?: (user: User) => void;
}

interface User {
  id: number;
  name: string;
  email: string;
}

// Context
const UserContext = createContext<User | null>(null);

// Custom hooks
function useUser(id: number) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setUser({ id, name: 'Test User', email: 'test@example.com' });
      setLoading(false);
    }, 1000);
  }, [id]);
  
  return { user, loading };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

// Functional component with hooks
export const UserProfile: React.FC<UserProps> = ({ id, name, email, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name, email: email || '' });
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, loading } = useUser(id);
  
  const debouncedName = useDebounce(formData.name, 300);
  
  const handleSave = useCallback(() => {
    if (onUpdate) {
      onUpdate({ id, name: formData.name, email: formData.email });
    }
    setIsEditing(false);
  }, [id, formData, onUpdate]);
  
  const memoizedUserInfo = useMemo(() => {
    return user ? `${user.name} (${user.email})` : 'Loading...';
  }, [user]);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);
  
  if (loading) {
    return <div>Loading user...</div>;
  }
  
  return (
    <div className="user-profile">
      <h2>{memoizedUserInfo}</h2>
      {isEditing ? (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <input
            ref={inputRef}
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Name"
          />
          <input
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
            type="email"
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
        </form>
      ) : (
        <div>
          <p>Name: {name}</p>
          <p>Email: {email}</p>
          <button onClick={() => setIsEditing(true)}>Edit</button>
        </div>
      )}
    </div>
  );
};

// Arrow function component
export const UserCard = ({ id, name }: { id: number; name: string }) => {
  const contextUser = useContext(UserContext);
  
  return (
    <div className="user-card">
      <h3>{name}</h3>
      <p>ID: {id}</p>
      {contextUser && <p>Context: {contextUser.name}</p>}
    </div>
  );
};

// Forward ref component
export const FancyInput = forwardRef<HTMLInputElement, { placeholder: string }>(
  ({ placeholder }, ref) => {
    const [focused, setFocused] = useState(false);
    
    return (
      <input
        ref={ref}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={focused ? 'focused' : ''}
      />
    );
  }
);

FancyInput.displayName = 'FancyInput';

// Memoized component
export const ExpensiveComponent = memo<{ data: any[]; filter: string }>(
  ({ data, filter }) => {
    const filteredData = useMemo(() => {
      return data.filter(item => item.name.includes(filter));
    }, [data, filter]);
    
    return (
      <ul>
        {filteredData.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    );
  }
);

ExpensiveComponent.displayName = 'ExpensiveComponent';

// Class component with lifecycle methods
export class UserManager extends React.Component<
  { users: User[]; onUserSelect: (user: User) => void },
  { selectedUser: User | null; loading: boolean }
> {
  private timeoutId: NodeJS.Timeout | null = null;
  
  constructor(props: { users: User[]; onUserSelect: (user: User) => void }) {
    super(props);
    this.state = {
      selectedUser: null,
      loading: false
    };
  }
  
  componentDidMount() {
    console.log('UserManager mounted');
    this.loadInitialUser();
  }
  
  componentDidUpdate(prevProps: { users: User[] }) {
    if (prevProps.users.length !== this.props.users.length) {
      this.loadInitialUser();
    }
  }
  
  componentWillUnmount() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
  
  private loadInitialUser = () => {
    if (this.props.users.length > 0) {
      this.setState({ loading: true });
      this.timeoutId = setTimeout(() => {
        this.setState({
          selectedUser: this.props.users[0],
          loading: false
        });
      }, 500);
    }
  };
  
  handleUserSelect = (user: User) => {
    this.setState({ selectedUser: user });
    this.props.onUserSelect(user);
  };
  
  render() {
    const { users } = this.props;
    const { selectedUser, loading } = this.state;
    
    return (
      <div className="user-manager">
        <h2>User Manager</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <ul>
              {users.map(user => (
                <li 
                  key={user.id}
                  onClick={() => this.handleUserSelect(user)}
                  className={selectedUser?.id === user.id ? 'selected' : ''}
                >
                  {user.name}
                </li>
              ))}
            </ul>
            {selectedUser && (
              <div className="selected-user">
                <h3>Selected: {selectedUser.name}</h3>
                <p>Email: {selectedUser.email}</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
}

// Higher-order component
export function withLoading<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  const WithLoadingComponent = (props: P & { isLoading?: boolean }) => {
    const { isLoading, ...otherProps } = props;
    
    if (isLoading) {
      return <div>Loading...</div>;
    }
    
    return <WrappedComponent {...(otherProps as P)} />;
  };
  
  WithLoadingComponent.displayName = `withLoading(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithLoadingComponent;
}

// Component using HOC
const LoadableUserCard = withLoading(UserCard);
export { LoadableUserCard };