import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/api';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const { user } = useAuth();
    const [theme, setTheme] = useState('classic');

    useEffect(() => {
        if (user?.theme) {
            setTheme(user.theme);
        }
    }, [user]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const changeTheme = async (newTheme) => {
        setTheme(newTheme);
        if (user) {
            try {
                await api.post('/api/auth/update-theme', { theme: newTheme });
            } catch (error) {
                console.error('Failed to update theme on server:', error);
            }
        }
    };

    const themes = [
        { id: 'classic', name: 'Classic Burgundy', colors: ['#bb0633', '#a9052e', '#fcfdfe'] },
        { id: 'ocean', name: 'Ocean Blue', colors: ['#4a90e2', '#2c3e50', '#f0f7ff'] },
        { id: 'teal', name: 'Modern Teal', colors: ['#008080', '#004d4d', '#f4ffff'] },
        { id: 'sunset', name: 'Sunset Orange', colors: ['#f39c12', '#d35400', '#fffaf0'] },
        { id: 'midnight', name: 'Midnight Navy', colors: ['#34495e', '#2c3e50', '#ebf0f1'] },
        { id: 'minimal', name: 'Minimalist Gray', colors: ['#2d3436', '#2d3436', '#ffffff'] },
        { id: 'pastel', name: 'Pastel Dreams', colors: ['#FFFBEB', '#A7D7C5', '#FF8E9E', '#FFB7B2'] },
        { id: 'coastal', name: 'Coastal Sand', colors: ['#B4D8E7', '#F1F1E6', '#DDBEAA', '#BB9481'] },
        { id: 'sunny', name: 'Sunny Sky', colors: ['#FFFDE7', '#90CAF9', '#64B5F6', '#1E88E5'] },
        { id: 'slate', name: 'Slate Elegance', colors: ['#555879', '#94A3B8', '#E2E8F0', '#F8FAFC'] },
        { id: 'tropical', name: 'Tropical Teal', colors: ['#088395', '#F7EFE5', '#FF7B00', '#FFB07C'] },
    ];

    return (
        <ThemeContext.Provider value={{ theme, changeTheme, themes }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
