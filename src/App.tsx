import React from 'react';
// FIX: Added all the necessary imports
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PatientSuite from './pages/PatientSuite';
import EyeTrackingTest from './components/tests/EyeTrackingTest';
import FingerTapTest from './components/tests/FingerTapTest';
import './assets/styles/global.css';

const App: React.FC = () => {
    return (
        <Router>
            <div className="app-container">
                <nav className="main-nav">
                    <Link to="/">Home</Link>
                    <Link to="/patient-suite">Patient Suite</Link>
                    {/* Add a direct link for easy testing */}
                    <Link to="/test/finger-tap">Finger Tap Test</Link>
                </nav>

                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/patient-suite" element={<PatientSuite />} />
                        <Route path="/test/eye-tracking" element={<EyeTrackingTest />} />
                        <Route path="/test/finger-tap" element={<FingerTapTest />} />
                    </Routes>
                </main>

                <footer className="main-footer">
                    <p>&copy; 2025 Neurological Assessment Platform</p>
                </footer>
            </div>
        </Router>
    );
}

export default App;