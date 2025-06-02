import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawHandLandmarks } from '../../hooks/useMediaPipe';
import { calculateFingerTapDistance, analyzeTapData } from '../../utils/testCalculations';
import { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const TAP_THRESHOLD = 0.05;

interface TapTestResults {
    totalTaps: number;
    tapsPerSecond: number;
    averageTimeBetweenTaps: number;
    consistency: number;
}

const FingerTapTest: React.FC = () => {
    const { landmarker, isLoading } = useMediaPipe('hand');
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [wasTapped, setWasTapped] = useState(false);
    const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
    const [testResults, setTestResults] = useState<TapTestResults | null>(null);
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker || !videoRef.current.srcObject) {
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

    const enableWebcam = async () => {
        if (!landmarker) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadeddata = () => {
                    setIsWebcamEnabled(true);
                    requestRef.current = requestAnimationFrame(predictWebcam);
                };
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
        }
    };
    
    const handleStartTest = () => {
        setTapTimestamps([]);
        setTestResults(null);
        setIsTestRunning(true);
    };
    
    const handleStopTest = () => {
        setIsTestRunning(false);
        if (tapTimestamps.length > 1) {
            setTestResults(analyzeTapData(tapTimestamps));
        }
    };

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (videoRef.current && videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
            <div style={{ position: 'relative', width: '90vw', maxWidth: '640px', aspectRatio: '640 / 480', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '5px' }}>
                    <h3>Finger Tap Test</h3>
                    {isLoading && <p>Loading Model...</p>}
                    {!isWebcamEnabled && <button onClick={enableWebcam} disabled={isLoading}>Enable Webcam</button>}
                    {isWebcamEnabled && (
                        <>
                            <button onClick={handleStartTest} disabled={isTestRunning}>Start Test</button>
                            <button onClick={handleStopTest} disabled={!isTestRunning}>Stop Test</button>
                        </>
                    )}
                    {isTestRunning && <h2 style={{ margin: '10px 0 0 0', color: '#007aff' }}>Taps: {tapTimestamps.length}</h2>}
                </div>
            </div>
            {testResults && <ResultsVisualization title="Finger Tap Results" data={testResults} />}
        </div>
    );
};
export default FingerTapTest;