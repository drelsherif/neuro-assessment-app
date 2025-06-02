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
            requestRef.current = requestAnimationFrame(predictWebcam); // Keep trying if not ready
            return;
        }
        const handLandmarker = landmarker as HandLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, performance.now());
            drawHandLandmarks(ctx, results, canvas.width, canvas.height); // Draw hand landmarks

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

    const handleStopTest = useCallback(() => { /* ...same as before... */ }, []);
    
    const handleStartTest = () => { /* ...same as before... */ };
    
    const enableWebcam = async () => {
        if (!landmarker || isWebcamEnabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Start predictWebcam loop immediately after stream is assigned
                requestRef.current = requestAnimationFrame(predictWebcam);
                setIsWebcamEnabled(true);
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access webcam. Please ensure permissions are granted and try again.");
        }
    };

    useEffect(() => { /* ...same timer effect... */ }, [isTestRunning, timeLeft]);
    
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
                {!isWebcamEnabled && <button className="primary-button" onClick={enableWebcam} disabled={isLoading}>{isLoading ? "Loading Model..." : "Enable Webcam"}</button>}
                {isWebcamEnabled && !isTestRunning && <button className="primary-button" onClick={handleStartTest}>Start 10 Second Test</button>}
                {isTestRunning && <p>Test in progress...</p>}
            </div>
            {testResults && chartData && ( /* ...results and chart JSX... */ )}
        </div>
    );
};
export default FingerTapTest;