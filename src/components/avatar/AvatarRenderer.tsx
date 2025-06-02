import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber'; // Assuming you use this for 3D rendering
import { Mesh, SphereGeometry, MeshBasicMaterial } from 'three';
import { NormalizedLandmark } from '@mediapipe/tasks-vision'; // Import the specific type

// Define the shape of the component's props
interface AvatarRendererProps {
  faceLandmarks?: NormalizedLandmark[];
  handLandmarks?: NormalizedLandmark[];
  poseLandmarks?: NormalizedLandmark[];
}

const AvatarRenderer: React.FC<AvatarRendererProps> = ({
  faceLandmarks,
  handLandmarks,
  poseLandmarks,
}) => {
  const { scene } = useThree();

  useMemo(() => {
    // A simple way to clear previous landmarks
    while(scene.children.find(child => child.name === "landmark_dot")) {
        scene.remove(scene.children.find(child => child.name === "landmark_dot")!);
    }

    // Create face mesh
    if (faceLandmarks) {
      // Explicitly type the parameters of the forEach loop
      faceLandmarks.forEach((landmark: NormalizedLandmark, index: number) => {
        const dot = new Mesh(
          new SphereGeometry(0.01, 16, 16),
          new MeshBasicMaterial({ color: 0x00ff00 })
        );
        // Ensure landmark has x, y, z before setting position
        if(landmark.x && landmark.y && landmark.z) {
            dot.position.set(landmark.x, landmark.y, landmark.z);
        }
        dot.name = 'landmark_dot';
        scene.add(dot);
      });
    }

    // You can add similar rendering logic for handLandmarks and poseLandmarks here

  }, [faceLandmarks, handLandmarks, poseLandmarks, scene]);

  return null; // This component only manipulates the scene
};

export default AvatarRenderer;