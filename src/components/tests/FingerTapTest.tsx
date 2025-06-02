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
const TAP_THRESHOLD = 0.05;
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

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker || !videoRef.current.srcObject) {
            if (requestRef.current !== null) requestRef.current = requestAnimationFrame(predictWebcam); // Keep trying if not ready
            return;
        }
        const handLandmarker = landmarker as HandLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, performance.now());
            drawHandLandmarks(ctx, results, canvas.width, canvas.height);

            if (isTestRunning) { // Check if test is running
                // console.log('[FingerTapTest] predictWebcam - Test is running'); // DEBUG
                if (results.landmarks && results.landmarks.length > 0) {
                    const distance = calculateFingerTapDistance(results.landmarks[0]);
                    // console.log(`[FingerTapTest] Distance: ${distance}, WasTapped: ${wasTapped}`); // DEBUG
                    if (distance !== null) {
                        if (distance < TAP_THRESHOLD) {
                            if (!wasTapped) {
                                console.log('[FingerTapTest] TAP DETECTED!'); // DEBUG
                                setTapTimestamps(prev => [...prev, performance.now()]);
                                setWasTapped(true);
                            }
                        } else {
                            setWasTapped(false);
                        }
                    }
                }
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, wasTapped]);

    const handleStopTest = useCallback(() => {
        console.log('[FingerTapTest] handleStopTest called'); // DEBUG
        setIsTestRunning(false);
        setTimeLeft(0);
        if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);

        setTapTimestamps(currentTimestamps => {
            console.log('[FingerTapTest] Timestamps at stop:', currentTimestamps); // DEBUG
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
        console.log('[FingerTapTest] handleStartTest called'); // DEBUG
        setTapTimestamps([]);
        setTestResults(null);
        setChartData(null);
        setWasTapped(false);
        setIsTestRunning(true); // This should trigger effects and predictWebcam logic
        setTimeLeft(TEST_DURATION / 1000);
        testTimeoutRef.current = setTimeout(handleStopTest, TEST_DURATION);
    };
    
    const enableWebcam = async () => {
        console.log('[FingerTapTest] enableWebcam called'); // DEBUG
        if (!landmarker || isWebcamEnabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                requestRef.current = requestAnimationFrame(predictWebcam);
                setIsWebcamEnabled(true);
                console.log('[FingerTapTest] Webcam enabled, predictWebcam loop started.'); // DEBUG
            }
        } catch (err) { console.error("Error accessing webcam:", err); }
    };

    useEffect(() => {
        // console.log(`[FingerTapTest] isTestRunning state changed: ${isTestRunning}, timeLeft: ${timeLeft}`); // DEBUG
        if (isTestRunning && timeLeft > 0) {
            const timerId = setInterval(() => setTimeLeft(prevTime => Math.max(0, prevTime - 1)), 1000);
            return () => clearInterval(timerId);
        } else if (isTestRunning && timeLeft === 0) {
            console.log('[FingerTapTest] Timer reached 0, calling handleStopTest.'); // DEBUG
            handleStopTest();
        }
    }, [isTestRunning, timeLeft, handleStopTest]);
    
    useEffect(() => {
        return () => {
            console.log('[FingerTapTest] Unmounting, cleaning up.'); // DEBUG
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
            {testResults && chartData && (
                <div style={{ display: 'flex', gap: '2rem', width: '90%', maxWidth: '1000px', alignItems: 'stretch' }}>
                    <ResultsVisualization title="Finger Tap Results" data={testResults} />
                    <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h3>Rhythm Analysis</h3>
                        <Line data={chartData} />
                    </div>
                    
                </div>
            )}
        <div style={{
                position: 'fixed',
                bottom: '10px',
                left: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                zIndex: 100,
                fontSize: '12px',
                textAlign: 'left'
            }}>
                <h4>Debug Info (Finger Tap):</h4>
                <p>isLoading: {isLoading.toString()}</p>
                <p>isWebcamEnabled: {isWebcamEnabled.toString()}</p>
                <p>isTestRunning: {isTestRunning.toString()}</p>
                <p>timeLeft: {timeLeft}</p>
                <p>Tap Count: {tapTimestamps.length}</p>
                <p>wasTapped (state): {wasTapped.toString()}</p>
                {/* You could also try to display the last calculated distance here if you add another state for it */}
            </div>
        </div>
    );
};

export default FingerTapTest;