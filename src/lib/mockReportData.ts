export interface BackendReport {
    faceMetrics: {
        avgConfidence: number;
        percentTime: {
            [key: string]: number; // A key-value pair for emotion percentages
        };
    };
    hrvMetrics: {
        RMSSD: number;
        pNN50: number;
        SDNN: number;
    };
    voiceMetrics: {
        maxVolume: number;
        avgPitch: number;
        avgVolume: number;
    };
    reply: string;
}

// The mock data object, exactly as you provided
export const mockBackendReport: BackendReport = {
    "faceMetrics": {
        "avgConfidence": 0.9145849422669746,
        "percentTime": {
            "disgusted": 0.028169014084507043,
            "sad": 0.056338028169014086,
            "neutral": 0.8450704225352113,
            "angry": 0.04225352112676056,
            "surprised": 0.028169014084507043
        }
    },
    "hrvMetrics": {
        "RMSSD": 5.536274960720423,
        "pNN50": 0.0,
        "SDNN": 21.960118439498665
    },
    "voiceMetrics": {
        "maxVolume": 0.11784016061356432,
        "avgPitch": 13221.497685185186,
        "avgVolume": 0.023190099838926576
    },
    "reply": "Okay, based on the provided metrics, here are a few observations about the individual's emotional state and a potential actionable tip:\n\n**Observations:**\n\n1.  **Primarily Neutral with Glimmers of Negativity:** The facial expression data indicates a predominantly neutral state (84.5%). However, there are small percentages of sadness (5.6%), anger (4.2%), and disgust (2.8%). While these are low, their presence suggests underlying stressors or perhaps a slight discomfort that isn't overtly expressed. The high confidence in facial expression detection suggests these are reliable indicators.\n\n2.  **Physiologically Stressed but Managing:** The heart rate variability (HRV) data paints a picture of someone experiencing some level of physiological stress. Low SDNN, RMSSD, and pNN50 values are indicative of reduced parasympathetic activity and higher sympathetic activity, often associated with stress. The LF/HF ratio of 5.24 further supports this, as a higher ratio generally indicates increased stress and reduced relaxation. However, the fact that they are implementing routines suggests they are actively trying to manage this stress.\n\n3.  **Controlled and Measured Voice:** The voice data suggests a controlled and deliberate delivery. The average volume is quite low, indicating a lack of strong emotional expression. The average pitch is within a normal range, but the lack of significant variation (implied by the absence of pitch standard deviation) suggests a controlled tone. The MFCCs and spectral features don't point to any extreme emotional vocalizations.\n\n4.  **Content and Routine-Oriented:** The transcript reveals a focus on self-improvement and routine implementation. The individual is sharing positive changes they've made to their daily life, such as establishing a morning routine, using the Pomodoro Technique, and implementing a digital shutdown. This suggests a desire for structure and a proactive approach to well-being.\n\n**Actionable Tip:**\n\nGiven the signs of underlying stress despite the positive routines, I would suggest incorporating a more deliberate and mindful relaxation technique into their daily schedule. This could be:\n\n* **Recommendation:** \"While your routines are fantastic for structure and productivity, consider adding a dedicated 10-15 minute period of focused deep breathing or progressive muscle relaxation each day. This can help to directly counteract the physiological stress indicated by your HRV data and promote a greater sense of calm and well-being. Try doing this before bed to further enhance sleep quality.\"\n\n**Rationale:**\n\nThe actionable tip is designed to address the physiological stress identified in the HRV data. While routines are helpful, they may not be enough to fully mitigate the underlying stress. A dedicated relaxation technique can help to activate the parasympathetic nervous system, promoting relaxation and reducing the body's stress response.\n"
};