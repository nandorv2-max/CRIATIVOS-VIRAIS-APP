import React from 'react';
import UserAssetsSetupInstructions from './UserAssetsSetupInstructions.tsx';

// This component now acts as a simple wrapper to ensure the admin view
// shows the same, single source of truth for database setup as the user assets view.
const AdminSetupInstructions: React.FC = () => {
    return (
        <UserAssetsSetupInstructions
            isAdminContext={true}
            onRetry={() => window.location.reload()}
            error="A configuração de administrador está incompleta ou desatualizada."
        />
    );
};

export default AdminSetupInstructions;
