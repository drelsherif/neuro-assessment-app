import React from 'react';

// Use a generic 'data' prop to make this component reusable
interface ResultsProps {
    title: string;
    data: Record<string, any>;
}

export const ResultsVisualization: React.FC<ResultsProps> = ({ title, data }) => {
    // A helper to format the keys for display
    const formatLabel = (key: string) => {
        return key
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter
    };

    return (
        <div style={{
            padding: '20px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9',
            minWidth: '300px'
        }}>
            <h3>{title}</h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {Object.entries(data).map(([key, value]) => (
                    <li key={key} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                        <strong>{formatLabel(key)}:</strong> {value}
                    </li>
                ))}
            </ul>
        </div>
    );
};