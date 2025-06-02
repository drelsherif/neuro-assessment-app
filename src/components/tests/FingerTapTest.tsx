import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawHandLandmarks } from '../../hooks/useMediaPipe';
import { analyzeTapData } from '../../utils/testCalculations';
import { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const TEST_DURATION = 10000; // 10 seconds
const MOVEMENT_THRESHOLD_PIXELS = 10; 
const DEBOUNCE_TIME_MS = 200;

interface TapTestResults { /* ... */ }

const FingerTapTest: React.FC = () => {
    const { landmarker, isLoading } = useMediaPipe('hand');
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
    const [testResults, setTestResults] = useState<TapTestResults | null>(null);
    const [chartData, setChartData] = useState<any>(null);

    const lastFingerTipY = useRef<number | null>(null);
    const lastTapTime = useRef<number>(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Debug States for this specific issue ---
    const [debugPredictLoopRunning, setDebugPredictLoopRunning] = useState(false);

    const predictWebcam = useCallback(() => {
        // Ensure critical refs and landmarker are available, and video is playing
        if (!videoRef.current || !canvasRef.current || !landmarker || 
            !videoRef.current.srcObject || videoRef.current.paused || videoRef.current.ended) {
            // If not ready, try again on the next frame but only if a loop was intentionally started
            if (requestRef.current !== null) { // Check if loop should be running
                 requestRef.current = requestAnimationFrame(predictWebcam);
            }
            return;
        }
        
        // Set debug flag if we've made it this far
        if (!debugPredictLoopRunning) setDebugPredictLoopRunning(true);

        const handLandmarker = landmarker as HandLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, performance.now());
            drawHandLandmarks(ctx, results, canvas.width, canvas.height); // This clears and draws

            if (isTestRunning && results.landmarks && results.landmarks.length > 0) {
                const handLandmarks = results.landmarks[0];
                const indexTip = handLandmarks[8];

                if (indexTip && canvasRef.current) {
                    const tipY = indexTip.y * canvasRef.current.height;
                    if (lastFingerTipY.current !== null) {
                        const movement = Math.abs(tipY - lastFingerTipY.current);
                        if (movement > MOVEMENT_THRESHOLD_PIXELS) {
                            const currentTime = Date.now();
                            if (currentTime - lastTapTime.current > DEBOUNCE_TIME_MS) {
                                setTapTimestamps(prev => [...prev, currentTime]);
                                lastTapTime.current = currentTime;
                            }
                        }
                    }
                    lastFingerTipY.current = tipY;
                }
            } else if (!isTestRunning) {
                lastFingerTipY.current = null;
            }
        }
        // Keep the loop going
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, debugPredictLoopRunning]); // debugPredictLoopRunning ensures re-memo if it changes

    const handleStopTest = useCallback(() => { /* ...same as before, ensure it sets isTestRunning to false ... */ }, []);
    
    const handleStartTest = () => { /* ...same as before, ensure it sets isTestRunning to true... */ };
    
    const enableWebcam = async () => {
        if (isLoading || isWebcamEnabled || !landmarker) {
            console.log("Enable webcam pre-checks failed or already enabled/loading:", {isLoading, isWebcamEnabled, landmarkerExists: !!landmarker});
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                
                // Wait for the video to be ready to play before starting the prediction loop
                videoRef.current.onloadedmetadata = () => { // Using onloadedmetadata as it's usually reliable
                    if (videoRef.current) videoRef.current.play(); // Ensure video plays on mobile
                    
                    // Ensure predictWebcam loop is started only once
                    if (requestRef.current === null) {
                        requestRef.current = requestAnimationFrame(predictWebcam);
                    }
                    setIsWebcamEnabled(true);
                    setDebugPredictLoopRunning(false); // Reset for next check
                };
                 // Fallback if onloadedmetadata doesn't fire quickly or at all in some cases
                 // Though it should be preferred to ensure video dimensions are known
                setTimeout(() => {
                    if (!isWebcamEnabled && videoRef.current && videoRef.current.srcObject){
                         if (requestRef.current === null) {
                            requestRef.current = requestAnimationFrame(predictWebcam);
                         }
                         setIsWebcamEnabled(true);
                         setDebugPredictLoopRunning(false);
                         console.log("Fallback webcam enable triggered")
                    }
                }, 1000);


            }
        } catch (err) { 
            console.error("Error accessing webcam:", err);
            alert("Could not access webcam. Error: " + (err as Error).message);
        }
    };

    useEffect(() => { /* ...same timer effect logic as before... */ }, [isTestRunning, timeLeft, handleStopTest]);
    
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
                <p>Tap your index finger (like tapping a desk) clearly and consistently for 10 seconds.</p>
                {!isWebcamEnabled && <button className="primary-button" onClick={enableWebcam} disabled={isLoading}>{isLoading ? "Loading Model..." : "Enable Webcam"}</button>}
                {isWebcamEnabled && !isTestRunning && <button className="primary-button" onClick={handleStartTest}>Start 10 Second Test</button>}
                {isTestRunning && <p>Test in progress...</p>}
            </div>

            {/* VISUAL DEBUGGER - Focus on webcam enabling and predict loop */}
            <div style={{
                background: 'rgba(200,200,200,0.8)', padding: '10px', marginTop: '10px', borderRadius: '5px',
                fontSize: '12px', textAlign: 'left', maxWidth: '640px', width: '90vw'
            }}>
                <h4>Debug Info (Finger Tap - Webcam & Loop):</h4>
                <p>isLoading Model: {isLoading.toString()}</p>
                <p>isWebcamEnabled (state): {isWebcamEnabled.toString()}</p>
                <p>Predict Loop Actively Running: {debugPredictLoopRunning.toString()}</p>
                <p>isTestRunning (state): {isTestRunning.toString()}</p>
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
export default FingerTapTest;