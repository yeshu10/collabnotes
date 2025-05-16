import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks
export const getNotifications = createAsyncThunk(
    'notifications/getNotifications',
    async ({ page = 1, limit = 10, unreadOnly = false }) => {
        const response = await axios.get(`/api/notifications`, {
            params: { page, limit, unreadOnly }
        });
        return response.data;
    }
);

export const markNotificationsRead = createAsyncThunk(
    'notifications/markRead',
    async ({ notificationIds }) => {
        await axios.patch('/api/notifications/read', { notificationIds });
        return notificationIds;
    }
);

export const deleteNotifications = createAsyncThunk(
    'notifications/delete',
    async ({ notificationIds }) => {
        await axios.delete('/api/notifications', { data: { notificationIds } });
        return notificationIds;
    }
);

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState: {
        notifications: [],
        loading: false,
        error: null,
        pagination: null,
        unreadCount: 0
    },
    reducers: {
        addNotification: (state, action) => {
            state.notifications.unshift(action.payload);
            if (!action.payload.read) {
                state.unreadCount += 1;
            }
        },
        clearNotifications: (state) => {
            state.notifications = [];
            state.unreadCount = 0;
        }
    },
    extraReducers: (builder) => {
        builder
            // Get notifications
            .addCase(getNotifications.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getNotifications.fulfilled, (state, action) => {
                state.loading = false;
                state.notifications = action.payload.notifications;
                state.pagination = action.payload.pagination;
                state.unreadCount = action.payload.notifications.filter(n => !n.read).length;
            })
            .addCase(getNotifications.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            })

            // Mark as read
            .addCase(markNotificationsRead.fulfilled, (state, action) => {
                const notificationIds = action.payload;
                state.notifications = state.notifications.map(notification => 
                    notificationIds.includes(notification._id)
                        ? { ...notification, read: true }
                        : notification
                );
                state.unreadCount = state.notifications.filter(n => !n.read).length;
            })

            // Delete notifications
            .addCase(deleteNotifications.fulfilled, (state, action) => {
                const notificationIds = action.payload;
                state.notifications = state.notifications.filter(
                    notification => !notificationIds.includes(notification._id)
                );
                state.unreadCount = state.notifications.filter(n => !n.read).length;
            });
    }
});

export const { addNotification, clearNotifications } = notificationsSlice.actions;

export default notificationsSlice.reducer; 