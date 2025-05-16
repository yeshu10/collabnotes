import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  notes: [],
  currentNote: null,
  loading: false,
  error: null,
};

const notesSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {
    setNotes: (state, action) => {
      console.log('Setting notes in store:', action.payload);
      // Make sure action.payload is an array
      const notesArray = Array.isArray(action.payload) ? action.payload : [];
      
      if (state.notes.length === 0) {
        // First load, just set the notes directly
        state.notes = notesArray;
      } else {
        // Merge notes properly, updating existing notes and adding new ones
        const mergedNotes = [...state.notes];
        
        // Update existing notes and collect IDs
        notesArray.forEach(newNote => {
          const existingIndex = mergedNotes.findIndex(note => note._id === newNote._id);
          if (existingIndex !== -1) {
            // Update existing note
            mergedNotes[existingIndex] = { ...mergedNotes[existingIndex], ...newNote };
          } else {
            // Add new note
            mergedNotes.push(newNote);
          }
        });
        
        // Sort by last updated
        mergedNotes.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
        state.notes = mergedNotes;
      }
      
      state.loading = false;
      state.error = null;
    },
    setCurrentNote: (state, action) => {
      // Update the current note in the notes array as well to ensure consistency
      if (action.payload) {
        const noteIndex = state.notes.findIndex(note => note._id === action.payload._id);
        if (noteIndex !== -1) {
          state.notes[noteIndex] = { ...state.notes[noteIndex], ...action.payload };
        } else {
          // If the note doesn't exist in the array, add it
          state.notes.push(action.payload);
        }
      }
      state.currentNote = action.payload;
    },
    updateNote: (state, action) => {
      if (!action.payload || !action.payload._id) {
        console.error('Invalid note update payload:', action.payload);
        return;
      }
      
      console.log('Updating note in Redux:', action.payload);
      const index = state.notes.findIndex(note => note._id === action.payload._id);
      
      if (index !== -1) {
        // Preserve important fields if they exist in the current note but not in the payload
        const preservedFields = { 
          collaborators: state.notes[index].collaborators,
          createdBy: state.notes[index].createdBy
        };
        
        state.notes[index] = {
          ...state.notes[index],
          ...action.payload,
          // Ensure we don't lose collaborators or creator info in real-time updates
          collaborators: action.payload.collaborators || preservedFields.collaborators,
          createdBy: action.payload.createdBy || preservedFields.createdBy,
          lastUpdated: action.payload.lastUpdated || new Date().toISOString()
        };
      } else {
        // If the note doesn't exist in our state, add it
        state.notes.push({
          ...action.payload,
          lastUpdated: action.payload.lastUpdated || new Date().toISOString()
        });
      }
      
      // Also update currentNote if it's the same note
      if (state.currentNote?._id === action.payload._id) {
        state.currentNote = {
          ...state.currentNote,
          ...action.payload,
          lastUpdated: action.payload.lastUpdated || new Date().toISOString()
        };
      }
    },
    addNote: (state, action) => {
      // Check if note already exists
      const exists = state.notes.some(note => note._id === action.payload._id);
      if (!exists) {
        state.notes.unshift(action.payload);
      } else {
        // Update the existing note
        const index = state.notes.findIndex(note => note._id === action.payload._id);
        if (index !== -1) {
          state.notes[index] = {
            ...state.notes[index],
            ...action.payload
          };
        }
      }
    },
    removeNote: (state, action) => {
      state.notes = state.notes.filter(note => note._id !== action.payload);
      if (state.currentNote?._id === action.payload) {
        state.currentNote = null;
      }
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearNotes: (state) => {
      state.notes = [];
      state.currentNote = null;
      state.loading = false;
      state.error = null;
    }
  },
});

export const {
  setNotes,
  setCurrentNote,
  updateNote,
  addNote,
  removeNote,
  setLoading,
  setError,
  clearNotes
} = notesSlice.actions;

export default notesSlice.reducer; 