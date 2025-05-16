import { createSlice } from '@reduxjs/toolkit';

// Helper function to safely parse JSON from localStorage
const getStoredUser = () => {
  try {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error parsing stored user data:', error);
    return null;
  }
};

const initialState = {
  user: getStoredUser(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token') && !!getStoredUser(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      
      // Log the raw user data
      console.log('Raw user data from login:', user);
      
      // Ensure both id and _id are set
      const normalizedUser = {
        ...user,
        id: user.id || user._id,
        _id: user._id || user.id
      };

      // Set state
      state.user = normalizedUser;
      state.token = token;
      state.isAuthenticated = true;
      
      // Store in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      console.log('Auth state updated:', {
        userId: state.user.id,
        user_Id: state.user._id,
        userName: state.user.name,
        isAuthenticated: state.isAuthenticated,
        completeUser: state.user
      });
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer; 