// ... other imports
import FingerTapTest from './components/tests/FingerTapTest';

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
                        {/* ... other routes ... */}
                        <Route path="/test/eye-tracking" element={<EyeTrackingTest />} />
                        <Route path="/test/finger-tap" element={<FingerTapTest />} />
                    </Routes>
                </main>
                {/* ... footer ... */}
            </div>
        </Router>
    );
}

export default App;