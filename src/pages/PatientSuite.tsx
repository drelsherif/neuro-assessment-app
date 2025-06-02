import React from 'react';
import { Link } from 'react-router-dom';

const PatientSuite: React.FC = () => {
    return (
        <div className="card">
            <h2>Patient Suite</h2>
            <p>From here, you will be able to start new tests and view your session history.</p>
            <br />
            <Link to="/test/eye-tracking" className="primary-button">
                Begin a New Eye Movement Test
            </Link>
        </div>
    );
};

export default PatientSuite;