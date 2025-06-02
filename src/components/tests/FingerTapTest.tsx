import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawHandLandmarks } from '../../hooks/useMediaPipe';
import { calculateFingerTapDistance, analyzeTapData } from '../../utils/testCalculations';
import { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
// STARTING THRESHOLD - YOU WILL LIKELY NEED TO ADJUST THIS!
const TAP_THRESHOLD = 0.1; // Increased starting point, but check debug output
const TEST_DURATION = 10000; // 10 seconds

interface TapTestResults {
    totalTaps: number;
    tapsPerSecond: number;
    averageTimeBetweenTaps: number;
    consistency: number;
}

const FingerTapTest: React.FC = () => {
    const { landmarker, isLoading } = useMediaPipe('hand');
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [wasTapped, setWasTapped] = useState(false);
    const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
    const [testResults, setTestResults] = useState<TapTestResults | null>(null);
    const [chartData, setChartData] = useState<any>(null);
    const [debugDistance, setDebugDistance] = useState<number | null>(null); // For on-screen distance

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker || !videoRef.current.srcObject) {
            if (requestRef.current !== null) requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }
        const handLandmarker = landmarker as HandLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, performance.now());
            drawHandLandmarks(ctx, results, canvas.width, canvas.height);

            if (results.landmarks && results.landmarks.length > 0) {
                const distance = calculateFingerTapDistance(results.landmarks[0]);
                setDebugDistance(distance); // Update live distance for debugging

                if (isTestRunning) {
                    if (distance !== null) {
                        if (distance < TAP_THRESHOLD) {
                            if (!wasTapped) {
                                setTapTimestamps(prev => [...prev, performance.now()]);
                                setWasTapped(true);
                            }
                        } else {
                            setWasTapped(false);
                        }
                    } else {
                         setWasTapped(false); // Reset if distance cannot be calculated
                    }
                }
            } else {
                setDebugDistance(null); // No landmarks, no distance
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, wasTapped]); // Removed TAP_THRESHOLD from deps as it's a const

    const handleStopTest = useCallback(() => {
        setIsTestRunning(false);
        setTimeLeft(0);
        if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);

        setTapTimestamps(currentTimestamps => {
            if (currentTimestamps.length > 1) {
                const analysis = analyzeTapData(currentTimestamps);
                setTestResults(analysis);
                const intervals = [];
                for (let i = 1; i < currentTimestamps.length; i++) {
                    intervals.push(currentTimestamps[i] - currentTimestamps[i - 1]);
                }
                setChartData({
                    labels: intervals.map((_, index) => `Interval ${index + 1}`),
                    datasets: [{
                        label: 'Time Between Taps (ms)', data: intervals,
                        borderColor: 'rgb(75, 192, 192)', tension: 0.1,
                    }]
                });
            } else {
                setTestResults({ totalTaps: currentTimestamps.length, tapsPerSecond: 0, averageTimeBetweenTaps: 0, consistency: 0 });
                setChartData(null);
            }
            return currentTimestamps; 
        });
    }, []);
    
    const handleStartTest = () => {
        setTapTimestamps([]);
        setTestResults(null);
        setChartData(null);
        setWasTapped(false); 
        setIsTestRunning(true); 
        setTimeLeft(TEST_DURATION / 1000);
        testTimeoutRef.current = setTimeout(handleStopTest, TEST_DURATION);
    };
    
    const enableWebcam = async () => {
        if (!landmarker || isWebcamEnabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                requestRef.current = requestAnimationFrame(predictWebcam);
                setIsWebcamEnabled(true);
            }
        } catch (err) { console.error("Error accessing webcam:", err); }
    };

    useEffect(() => {
        if (isTestRunning && timeLeft > 0) {
            const timerId = setInterval(() => setTimeLeft(prevTime => Math.max(0, prevTime - 1)), 1000);
            return () => clearInterval(timerId);
        } else if (isTestRunning && timeLeft === 0) {
            handleStopTest();
        }
    }, [isTestRunning, timeLeft, handleStopTest]);
    
    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
            <div style={{ position: 'relative', width: '90vw', maxWidth: '640px', aspectRatio: '640 / 480', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '10px 15px', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {isTestRunning ? `Time Left: ${timeLeft}` : (testResults ? "Test Finished" : (isWebcamEnabled ? "Ready" : "Waiting Webcam"))}
                </div>
                {isTestRunning && <h2 style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '5px' }}>Taps: {tapTimestamps.length}</h2>}
            </div>
            <div className="card" style={{padding: '1rem'}}>
                <p>Tap your thumb and index finger together as quickly and consistently as you can for 10 seconds.</p>
                {!isWebcamEnabled && <button className="primary-button" onClick={enableWebcam} disabled={isLoading}>{isLoading ? "Loading Model..." : "Enable Webcam"}</button>}
                {isWebcamEnabled && !isTestRunning && <button className="primary-button" onClick={handleStartTest}>Start 10 Second Test</button>}
                {isTestRunning && <p>Test in progress...</p>}
            </div>

            {/* VISUAL DEBUGGER - REMOVE LATER */}
            <div style={{
                background: 'rgba(200,200,200,0.8)', padding: '10px', marginTop: '10px', borderRadius: '5px',
                fontSize: '12px', textAlign: 'left', maxWidth: '640px', width: '90vw'
            }}>
                <h4>Debug Info (Finger Tap):</h4>
                <p>isWebcamEnabled: {isWebcamEnabled.toString()}</p>
                <p>isTestRunning: {isTestRunning.toString()}</p>
                <p>wasTapped (state): {wasTapped.toString()}</p>
                <p>Live Distance: {debugDistance === null ? 'N/A' : debugDistance.toFixed(4)}</p>
                <p>Current TAP_THRESHOLD: {TAP_THRESHOLD}</p>
            </div>

            {testResults && chartData && (
                <div style={{ display: 'flex', gap: '2rem', width: '90%', maxWidth: '1000px', alignItems: 'stretch', marginTop: '1rem' }}>
                    <ResultsVisualization title="Finger Tap Results" data={testResults} />
                    <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h3>Rhythm Analysis</h3>
                        <Line data={chartData} />
                    </div>
                </div>
            )}
        </div>
    );
};
export default FingerTapTest;