import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import LoginScreen from './components/LoginScreen';
import MainDashboard from './components/MainDashboard';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };
    
    const handleLogout = () => {
        setIsAuthenticated(false);
    };

    return (
        <AnimatePresence mode="wait">
            {isAuthenticated ? (
                 <motion.div
                    key="dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <MainDashboard onLogout={handleLogout} />
                </motion.div>
            ) : (
                <motion.div
                    key="login"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <LoginScreen onLoginSuccess={handleLoginSuccess} />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default App;