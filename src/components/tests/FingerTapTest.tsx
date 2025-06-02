import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawHandLandmarks } from '../../hooks/useMediaPipe';
import { calculateFingerTapDistance, analyzeTapData } from '../../utils/testCalculations';
import { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// --- Constants ---
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const TAP_THRESHOLD = 0.05;
const TEST_DURATION = 10000; // 10 seconds in milliseconds

// --- Interfaces ---
interface TapTestResults {
    totalTaps: number;
    tapsPerSecond: number;
    averageTimeBetweenTaps: number;
    consistency: number;
}

const FingerTapTest: React.FC = () => {
    // --- State Management ---
    const { landmarker, isLoading } = useMediaPipe('hand');
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [instructionsVisible, setInstructionsVisible] = useState(true);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [wasTapped, setWasTapped] = useState(false);
    const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
    const [testResults, setTestResults] = useState<TapTestResults | null>(null);
    const [chartData, setChartData] = useState<any>(null);

    // --- Refs ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Core Logic ---
    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker || !videoRef.current.srcObject) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }
        const handLandmarker = landmarker as HandLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, performance.now());
            drawHandLandmarks(ctx, results, canvas.width, canvas.height);

            if (isTestRunning && results.landmarks && results.landmarks.length > 0) {
                const distance = calculateFingerTapDistance(results.landmarks[0]);
                if (distance !== null) {
                    if (distance < TAP_THRESHOLD) {
                        if (!wasTapped) {
                            setTapTimestamps(prev => [...prev, performance.now()]);
                            setWasTapped(true);
                        }
                    } else {
                        setWasTapped(false);
                    }
                }
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, wasTapped]);

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
                    labels: intervals.map((_, index) => `Tap ${index + 1}`),
                    datasets: [{
                        label: 'Time Between Taps (ms)',
                        data: intervals,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                    }]
                });
            }
            return currentTimestamps;
        });
    }, []);
    
    const handleStartTest = () => {
        setInstructionsVisible(false);
        setTapTimestamps([]);
        setTestResults(null);
        setChartData(null);
        setIsTestRunning(true);
        setTimeLeft(TEST_DURATION / 1000);

        requestRef.current = requestAnimationFrame(predictWebcam);
        testTimeoutRef.current = setTimeout(handleStopTest, TEST_DURATION);
    };
    
    const enableWebcamAndStart = async () => {
        if (!landmarker || isWebcamEnabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadeddata = () => {
                    setIsWebcamEnabled(true);
                    handleStartTest();
                };
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access webcam. Please ensure permissions are granted and try again.");
        }
    };

    useEffect(() => {
        if (isTestRunning && timeLeft > 0) {
            const timerId = setInterval(() => {
                setTimeLeft(prevTime => Math.max(0, prevTime - 1));
            }, 1000);
            return () => clearInterval(timerId);
        }
    }, [isTestRunning, timeLeft]);
    
    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    if (instructionsVisible) {
        return (
            <div className="card">
                <h2>Finger Tap Test Instructions</h2>
                <p>You will have <strong>10 seconds</strong> to tap your thumb and index finger together as quickly and consistently as you can.</p>
                <p>Please position your hand clearly in front of the camera.</p>
                <button className="primary-button" onClick={enableWebcamAndStart} disabled={isLoading}>
                    {isLoading ? "Loading Model..." : "Start 10 Second Test"}
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
            <div style={{ position: 'relative', width: '90vw', maxWidth: '640px', aspectRatio: '640 / 480', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '10px 15px', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {timeLeft > 0 ? `Time Left: ${timeLeft}` : "Test Finished"}
                </div>
                {isTestRunning && <h2 style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '5px' }}>Taps: {tapTimestamps.length}</h2>}
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
        </div>
    );
};
export default FingerTapTest;