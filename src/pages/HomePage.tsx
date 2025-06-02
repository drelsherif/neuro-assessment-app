import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
    return (
        <div className="card">
            <h1>Welcome to the Neurological Assessment Platform</h1>
            <p style={{ fontSize: '1.2rem', color: '#6c757d', margin: '1rem 0 2rem 0' }}>
                Perform standardized neurological tests using your device's camera.
                <br />
                Select an option below to get started.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                {/* This link will take the user to the patient dashboard */}
                <Link to="/patient-suite" className="primary-button">
                    Go to Patient Suite
                </Link>
                {/* This is a temporary link for quick access during development */}
                <Link to="/test/eye-tracking" className="primary-button">
                    Start Eye Tracking Test
                </Link>
            </div>
        </div>
    );
};

export default HomePage;