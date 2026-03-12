import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useReducer, useRef, useState } from 'react';

import { initializeApp } from "firebase/app";
import { addDoc, collection, doc, getDocs, getFirestore, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

// Your Campus Fit project configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';

// --- 1. CONFIGURATION ---
const SERVER_URL = "https://thirty-symbols-say.loca.lt";

const DEFAULT_PRIMARY = "#000000"; 
const DEFAULT_SECONDARY = "#007AFF"; 
const BASE_WORKOUT_XP = 150; 
const MAX_VOLUME_XP = 500;   
const XP_PER_1K_LBS = 15;
// 🚨 NEW: The Cardio XP Multiplier!
const XP_PER_CARDIO_MIN = 6;    
const CATEGORIES = ['Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core', 'Cardio', 'Full Body', 'Other'];

const BADGES = [
  { id: 'first_lift', name: 'First Blood', icon: '🩸', condition: (s) => s.workoutsCompleted >= 1 },
  { id: '10k_club', name: '10k Club', icon: '🏋️', condition: (s) => s.totalVolume >= 10000 },
  { id: 'streak_3', name: 'On Fire', icon: '🔥', condition: (s) => s.weekStreak >= 3 },
  { id: 'level_5', name: 'Varsity', icon: '⭐', condition: (s) => s.level >= 5 },
];

const DEFAULT_EXERCISES = [
  { id: 'cardio_1', name: 'Running (Treadmill)', category: 'Cardio' },
  { id: 'cardio_2', name: 'Stairmaster', category: 'Cardio' },
  { id: 'cardio_3', name: 'Swimming', category: 'Cardio' },
  { id: 'cardio_4', name: 'Cycling (Stationary)', category: 'Cardio' },
  { id: 'arm_1', name: 'Barbell Curls', category: 'Arms' },
  { id: 'chest_1', name: 'Bench Press (Barbell)', category: 'Chest' },
  { id: 'chest_9', name: 'Bench Press (Dumbbell)', category: 'Chest'},
  { id: 'back_14', name: 'Bent Over Row (Dumbbell)', category: 'Back' },
  { id: 'legs_21', name: 'Bulgarian Split Squats', category: 'Legs' },
  { id: 'chest_10', name: 'Cable Crossovers', category: 'Chest' },
  { id: 'legs_22', name: 'Calf Raises', category: 'Legs' },
  { id: 'core_2', name: 'Crunches', category: 'Core' },
  { id: 'back_15', name: 'Deadlift (Barbell)', category: 'Back' },
  { id: 'shld_11', name: 'Front Raises (Dumbbell)', category: 'Shoulders' },
  { id: 'arm_2', name: 'Hammer Curls (Dumbbell)', category: 'Arms' },
  { id: 'chest_11', name: 'Incline Bench Press (Dumbbell)', category: 'Chest' },
  { id: 'back_16', name: 'Lat Pulldown', category: 'Back' },
  { id: 'shld_12', name: 'Lateral Raises (Dumbbell)', category: 'Shoulders' },
  { id: 'legs_16', name: 'Leg Curl', category: 'Legs' },
  { id: 'legs_17', name: 'Leg Extension', category: 'Legs' },
  { id: 'legs_18', name: 'Leg Press', category: 'Legs' },
  { id: 'core_3', name: 'Leg Raises', category: 'Core' },
  { id: 'legs_19', name: 'Lunges (Dumbbell)', category: 'Legs' },
  { id: 'shld_13', name: 'Overhead Press (Barbell)', category: 'Shoulders' },
  { id: 'shld_10', name: 'Overhead Press (Dumbbell)', category: 'Shoulders' },
  { id: 'core_1', name: 'Plank', category: 'Core' },
  { id: 'back_17', name: 'Pull-ups', category: 'Back' },
  { id: 'chest_12', name: 'Push-ups', category: 'Chest' },
  { id: 'legs_20', name: 'Romanian Deadlift (Dumbbell)', category: 'Legs' },
  { id: 'core_4', name: 'Russian Twists', category: 'Core' },
  { id: 'arm_3', name: 'Skull Crushers', category: 'Arms' },
  { id: 'legs_1', name: 'Squat (Barbell)', category: 'Legs' },
  { id: 'legs_15', name: 'Squat (Dumbbell)', category: 'Legs' },
  { id: 'arm_4', name: 'Tricep Pushdown', category: 'Arms' }
];

// --- 3. HELPER FUNCTIONS ---
function calculateTotalVolume(workout) {
  let total = 0;
  workout.exercises.forEach((ex) => {
    // Skip volume math for Cardio exercises so stats stay accurate!
    if (ex.category === 'Cardio') return;

    ex.sets.forEach((set) => {
      const isCompleted = set.completed !== undefined ? set.completed : true; 
      if (isCompleted || workout.isTemplate) {
        const weight = Number(set.weightLbs) || 0;
        const reps = Number(set.reps) || (Number(set.targetReps) || 0);
        total += weight * reps;
      }
    });
  });
  return total;
}

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay(); 
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toDateString();
};

const generateFriendCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

// --- 4. REDUCER ---
const workoutReducer = (state, action) => {
  if (action.type === 'START') {
    return { 
      id: Date.now().toString(), 
      name: action.payload.name, 
      exercises: action.payload.exercises || [], 
      totalVolumeLbs: 0,
      isTemplate: action.payload.isTemplate || false
    };
  }
  
  if (!state) return null;

  switch (action.type) {
    case 'UPDATE_NAME':
      return { ...state, name: action.payload };

    case 'ADD_EXERCISE':
      return {
        ...state,
        exercises: [
          ...state.exercises, 
          { 
            id: Date.now().toString() + Math.random(), 
            name: action.payload.name,
            category: action.payload.category || 'Other',
            sets: action.payload.initialSets || [{ 
              id: Date.now().toString(), 
              reps: '', 
              targetReps: '',
              weightLbs: '', 
              completed: false 
            }], 
          }
        ],
      };
      
    case 'DELETE_EXERCISE': {
      const updated = state.exercises.filter((_, i) => i !== action.payload.index);
      return { 
        ...state, 
        exercises: updated, 
        totalVolumeLbs: calculateTotalVolume({ ...state, exercises: updated }) 
      };
    }
    
    case 'ADD_SET': {
      const updatedExercises = state.exercises.map((ex, eIndex) => {
        if (eIndex !== action.payload.exerciseIndex) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        return { 
          ...ex, 
          sets: [
            ...ex.sets, 
            { 
              id: Date.now().toString() + Math.random(), 
              reps: lastSet ? lastSet.reps : '', 
              targetReps: lastSet ? (lastSet.targetReps || lastSet.reps) : '',
              weightLbs: lastSet ? lastSet.weightLbs : '', 
              completed: false 
            }
          ] 
        };
      });
      return { ...state, exercises: updatedExercises };
    }

    case 'REMOVE_SET': {
      const updatedExercises = state.exercises.map((ex, eIndex) => {
        if (eIndex !== action.payload.exerciseIndex) return ex;
        const updatedSets = ex.sets.filter((_, sIndex) => sIndex !== action.payload.setIndex);
        return { ...ex, sets: updatedSets };
      });
      const newVolume = calculateTotalVolume({ ...state, exercises: updatedExercises });
      return { ...state, exercises: updatedExercises, totalVolumeLbs: newVolume };
    }
    
    case 'UPDATE_SET': {
      const updatedExercises = state.exercises.map((ex, eIndex) => {
        if (eIndex !== action.payload.exerciseIndex) return ex;
        const updatedSets = ex.sets.map((set, sIndex) => {
          if (sIndex !== action.payload.setIndex) return set;
          return { ...set, [action.payload.field]: action.payload.value };
        });
        return { ...ex, sets: updatedSets };
      });
      const newVolume = calculateTotalVolume({ ...state, exercises: updatedExercises });
      return { ...state, exercises: updatedExercises, totalVolumeLbs: newVolume };
    }
    
    case 'TOGGLE_COMPLETE': {
      const updatedExercises = state.exercises.map((ex, eIndex) => {
        if (eIndex !== action.payload.exerciseIndex) return ex;
        const updatedSets = [...ex.sets];
        const currentSet = updatedSets[action.payload.setIndex];
        const isCompleting = !currentSet.completed; 
        
        updatedSets[action.payload.setIndex] = { 
          ...currentSet, 
          completed: isCompleting 
        };
        
        if (isCompleting && action.payload.setIndex + 1 < updatedSets.length) {
          const nextSet = updatedSets[action.payload.setIndex + 1];
          if (!nextSet.weightLbs && (!nextSet.reps || nextSet.reps === '')) {
            updatedSets[action.payload.setIndex + 1] = { 
              ...nextSet, 
              weightLbs: currentSet.weightLbs, 
              reps: currentSet.reps || (nextSet.targetReps ? nextSet.targetReps.toString() : '') 
            };
          }
        }
        return { ...ex, sets: updatedSets };
      });
      const newVolume = calculateTotalVolume({ ...state, exercises: updatedExercises });
      return { ...state, exercises: updatedExercises, totalVolumeLbs: newVolume };
    }
    default: 
      return state;
  }
};

// --- 5. COMPONENT: REST TIMER ---
const RestTimer = ({ themePrimary, themeSecondary }) => {
  const [inputVal, setInputVal] = useState("90"); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      Vibration.vibrate([0, 500, 200, 500]); 
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      const parsed = parseInt(inputVal) || 90;
      setTimeLeft(parsed);
      setIsRunning(true);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={[styles.timerContainer, { borderColor: themeSecondary + '40', borderWidth: 1 }]}>
      <Text style={styles.timerLabel}>Rest (sec):</Text>
      <TextInput 
        style={styles.timerInput} 
        keyboardType="numeric" 
        value={inputVal} 
        onChangeText={setInputVal} 
        editable={!isRunning} 
      />
      <TouchableOpacity 
        style={[styles.timerBtn, { backgroundColor: isRunning ? '#ff4444' : themeSecondary }]} 
        onPress={toggleTimer}
      >
        <Text style={[styles.timerBtnText, styles.textOutline]}>
          {isRunning ? formatTime(timeLeft) + " - STOP" : "START"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// --- 6. COMPONENT: CALENDAR ICON ---
const CalendarIcon = ({ themeSecondary }) => {
  const date = new Date().getDate();
  return (
    <View style={styles.calendarIcon}>
      <View style={[styles.calendarHeader, { backgroundColor: themeSecondary }]} />
      <Text style={styles.calendarText}>{date}</Text>
    </View>
  );
};

// --- 7. COMPONENT: EXERCISE CARD ---
const ExerciseCard = ({ exercise, exIndex, dispatch, themePrimary, themeSecondary, isEditingTemplate = false }) => {
  const isCardio = exercise.category === 'Cardio';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{exercise.name}</Text>
        <TouchableOpacity 
          onPress={() => dispatch({ type: 'DELETE_EXERCISE', payload: { index: exIndex } })} 
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.rowHeader}>
        <Text style={styles.colLabel}>{isCardio ? "MINS" : "LBS"}</Text>
        <Text style={styles.colLabel}>{isEditingTemplate ? "TARGET" : (isCardio ? "DIST/LVL" : "REPS")}</Text>
        {!isEditingTemplate && <Text style={styles.colLabel}>DONE</Text>}
        <View style={{ width: 30, marginLeft: 8 }} /> 
      </View>
      {exercise.sets.map((set, setIndex) => (
        <View 
          key={set.id} 
          style={[styles.setRow, set.completed && !isEditingTemplate && { backgroundColor: themeSecondary + '10' }]}
        >
          <TextInput 
            style={styles.input} 
            placeholder="0" 
            keyboardType={isCardio ? "default" : "numeric"} 
            value={set.weightLbs} 
            onChangeText={(v) => dispatch({ type: 'UPDATE_SET', payload: { exerciseIndex: exIndex, setIndex, field: 'weightLbs', value: v }})} 
            editable={!set.completed || isEditingTemplate} 
          />
          <TextInput 
            style={styles.input} 
            placeholder="0" 
            keyboardType={isCardio ? "default" : "numeric"} 
            value={isEditingTemplate ? (set.targetReps?.toString() || set.reps?.toString()) : set.reps} 
            onChangeText={(v) => dispatch({ 
              type: 'UPDATE_SET', 
              payload: { exerciseIndex: exIndex, setIndex, field: isEditingTemplate ? 'targetReps' : 'reps', value: v }
            })} 
            editable={!set.completed || isEditingTemplate} 
          />
          {!isEditingTemplate && (
            <TouchableOpacity 
              style={[styles.checkbox, set.completed && { backgroundColor: themeSecondary }]}
              onPress={() => {
                Vibration.vibrate(40);
                dispatch({ type: 'TOGGLE_COMPLETE', payload: { exerciseIndex: exIndex, setIndex }})
              }}
            >
              {set.completed && (
                <Text style={[{ color: 'white' }, styles.textOutline]}>✓</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.deleteSetBtn} 
            onPress={() => dispatch({ type: 'REMOVE_SET', payload: { exerciseIndex: exIndex, setIndex }})}
          >
            <Text style={{ color: '#ff4444', fontWeight: 'bold', fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity 
        style={[styles.addSetBtn, { backgroundColor: themeSecondary + '15' }]} 
        onPress={() => dispatch({ type: 'ADD_SET', payload: { exerciseIndex: exIndex }})}
      >
        <Text style={[styles.addSetText, { color: themeSecondary }]}>
          {isCardio ? "+ Add Interval" : "+ Add Set"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// --- 8. SCREENS ---

// A. ONBOARDING
const OnboardingScreen = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleStart = async () => {
    Keyboard.dismiss();
    if (name.trim() && school.trim()) {
      setIsJoining(true); 
      let finalPrimary = DEFAULT_PRIMARY;
      let finalSecondary = DEFAULT_SECONDARY; 
      try {
        const response = await fetch(`${SERVER_URL}/get_school_color`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true'
          },
          body: JSON.stringify({ school_name: school.trim() })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.primary && data.secondary) {
            finalPrimary = data.primary;
            finalSecondary = data.secondary;
          }
        }
      } catch (error) {
        console.log("Could not fetch school color automatically.", error);
      }
      setIsJoining(false);
      const newFriendCode = generateFriendCode();
      onComplete(name, school.trim(), { primary: finalPrimary, secondary: finalSecondary }, newFriendCode);
    } else {
      Alert.alert("Missing Info", "Please enter your name and school!");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.onboardingContainer}>
        <View style={styles.onboardingCard}>
          <Text style={styles.onboardingTitle}>Welcome to Campus Fit 🎓</Text>
          <Text style={styles.onboardingSub}>Join your campus leaderboard.</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput 
              style={styles.onboardingInput} 
              placeholder="e.g. Josh" 
              value={name} 
              onChangeText={setName} 
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your School</Text>
            <TextInput 
              style={styles.onboardingInput} 
              placeholder="e.g. Michigan, Texas, UCLA..." 
              value={school} 
              onChangeText={setSchool} 
            />
          </View>
          <TouchableOpacity 
            style={[styles.bigStartBtn, isJoining && { backgroundColor: '#999' }]} 
            onPress={handleStart} 
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={[styles.bigStartText, styles.textOutline]}>JOIN CAMPUS</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// B. HOME
const HomeScreen = ({ userStats, userInfo, onStartWorkout, savedTemplates, onStartTemplate, onEditTemplate, onDeleteTemplate, themePrimary, themeSecondary }) => {
  const nextLevelXP = 10000;
  const progress = (userStats.currentXP / nextLevelXP) * 100;
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.screenTitle}>Hey, {userInfo.name}!</Text>
      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <Text style={styles.levelLabel}>Level {userStats.level}</Text>
          <Text style={[styles.levelRank, { color: themeSecondary }]}>{userStats.currentXP} XP</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: themePrimary }]} />
        </View>
        <Text style={styles.xpText}>Next Rank at {nextLevelXP.toLocaleString()} XP</Text>
      </View>
      <View style={styles.grid}>
        <View style={[styles.statSquare, { borderColor: themeSecondary + '30', borderWidth: 1 }]}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statNumber}>{userStats.weekStreak}</Text>
          <Text style={styles.statSub}>Week Streak</Text>
        </View>
        <View style={[styles.statSquare, { borderColor: themeSecondary + '30', borderWidth: 1 }]}>
          <CalendarIcon themeSecondary={themeSecondary} />
          <Text style={styles.statNumber}>{userStats.workoutsThisWeek || 0}</Text>
          <Text style={styles.statSub}>This Week</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={[styles.bigStartBtn, { backgroundColor: themePrimary, marginBottom: 30 }]} 
        onPress={onStartWorkout}
      >
        <Text style={[styles.bigStartText, styles.textOutline]}>START EMPTY WORKOUT</Text>
      </TouchableOpacity>
      {savedTemplates && savedTemplates.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.sectionHeader}>Your Templates</Text>
          <View style={{ paddingBottom: 20 }}>
            {savedTemplates.map((tmpl, i) => (
              <View key={i} style={styles.templateWrapper}>
                <View style={[styles.templateCard, { borderColor: themeSecondary + '50' }]}>
                  <Text style={styles.templateName}>{tmpl.name}</Text>
                  <Text style={styles.templateSub}>{tmpl.exercises.length} Exercises</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      style={[styles.startTmplBtn, { backgroundColor: themeSecondary + '15', flex: 1 }]}
                      onPress={() => onStartTemplate(tmpl)}
                    >
                      <Text style={{ color: themeSecondary, fontWeight: 'bold', fontSize: 12 }}>START</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.startTmplBtn, { backgroundColor: '#f0f0f0', flex: 1 }]}
                      onPress={() => onEditTemplate(tmpl, i)}
                    >
                      <Text style={{ color: '#666', fontWeight: 'bold', fontSize: 12 }}>EDIT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteTmplBtn} onPress={() => onDeleteTemplate(i)}>
                  <Text style={styles.deleteTmplText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

// C. ACTIVE WORKOUT 
const ActiveWorkoutScreen = ({ onFinish, onCancel, themePrimary, themeSecondary, initialData, exerciseDB, onAddCustomExercise, onUpdateCustomExercise, onDeleteCustomExercise }) => {
  const [workout, dispatch] = useReducer(workoutReducer, null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => { 
    if (initialData) {
      dispatch({ 
        type: 'START', 
        payload: { name: initialData.name, exercises: initialData.exercises } 
      });
    } else {
      dispatch({ type: 'START', payload: { name: "Afternoon Lift" } }); 
    }
  }, [initialData]);

  if (!workout) return <Text>Loading...</Text>;

  const handleCancelPress = () => {
    Alert.alert(
      "Cancel Workout?",
      "Are you sure? You will lose all data for this session.",
      [
        { text: "Keep Lifting", style: "cancel" },
        { text: "Yes, Exit", style: "destructive", onPress: onCancel }
      ]
    );
  };

  const handleFinishPress = () => {
    if (workout.totalVolumeLbs === 0 && workout.exercises.length === 0) {
      return Alert.alert("Empty Workout", "Log something first!");
    }
    Vibration.vibrate([0, 200, 100, 200]); 
    
    // 1. Base + Lifting XP
    const base = BASE_WORKOUT_XP;
    const volXP = Math.min(Math.floor(workout.totalVolumeLbs / 1000) * XP_PER_1K_LBS, MAX_VOLUME_XP);
    
    // 2. 🚨 NEW: Cardio XP Logic
    let cardioMinutes = 0;
    workout.exercises.forEach(ex => {
      if (ex.category === 'Cardio') {
        ex.sets.forEach(set => {
          if (set.completed) {
            cardioMinutes += Number(set.weightLbs) || 0; 
          }
        });
      }
    });
    const cardioXP = cardioMinutes * XP_PER_CARDIO_MIN;

    // 3. Finalize
    onFinish({
      name: workout.name, 
      xpEarned: base + volXP + cardioXP, // Mixes them together nicely
      volume: workout.totalVolumeLbs, 
      date: new Date().toLocaleDateString(), 
      exercises: workout.exercises 
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <Text style={[styles.screenTitle, { marginBottom: 0, flex: 1, marginRight: 15 }]} numberOfLines={2} adjustsFontSizeToFit>
            {workout.name}
          </Text>
          <TouchableOpacity onPress={handleCancelPress} style={{ paddingTop: 8 }}>
            <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <RestTimer themePrimary={themePrimary} themeSecondary={themeSecondary} />
        {workout.exercises.length === 0 && (
          <Text style={{ textAlign:'center', color:'#999', marginTop:40 }}>Tap + Add Exercise to begin</Text>
        )}
        {workout.exercises.map((ex, index) => (
          <ExerciseCard 
            key={ex.id} 
            exercise={ex} 
            exIndex={index} 
            dispatch={dispatch} 
            themePrimary={themePrimary} 
            themeSecondary={themeSecondary} 
          />
        ))}
        <TouchableOpacity 
          style={[styles.addExBtn, { borderColor: themeSecondary }]} 
          onPress={() => setShowPicker(true)}
        >
          <Text style={[styles.addExText, { color: themeSecondary }]}>+ Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity 
        style={[styles.finishBtn, { backgroundColor: themePrimary }]} 
        onPress={handleFinishPress}
      >
        <Text style={[styles.finishText, styles.textOutline]}>FINISH WORKOUT</Text>
      </TouchableOpacity>
      <ExercisePicker 
        visible={showPicker} 
        onClose={() => setShowPicker(false)} 
        onSelect={(item) => { 
          dispatch({ type: 'ADD_EXERCISE', payload: { name: item.name, category: item.category } }); 
          setShowPicker(false); 
        }} 
        exerciseDB={exerciseDB} 
        themePrimary={themePrimary} 
        themeSecondary={themeSecondary} 
        onAddCustom={onAddCustomExercise} 
        onUpdateCustom={onUpdateCustomExercise} 
        onDeleteCustom={onDeleteCustomExercise} 
      />
    </KeyboardAvoidingView>
  );
};

// C2. EDIT TEMPLATE SCREEN
const EditTemplateScreen = ({ onSave, onCancel, themePrimary, themeSecondary, initialData, exerciseDB, onAddCustomExercise, onUpdateCustomExercise, onDeleteCustomExercise }) => {
  const [workout, dispatch] = useReducer(workoutReducer, null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => { 
    if (initialData) {
      dispatch({ 
        type: 'START', 
        payload: { name: initialData.name, exercises: initialData.exercises, isTemplate: true } 
      });
    }
  }, [initialData]);

  if (!workout) return <Text>Loading...</Text>;

  const handleCancelPress = () => {
    Alert.alert("Discard Changes?", "Your edits to this template will be lost.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onCancel }
    ]);
  };

  const handleSavePress = () => {
    if (workout.name.trim() === '') return Alert.alert("Hold on", "Template needs a name!");
    Vibration.vibrate([0, 100, 50, 100]); 
    const cleanedExercises = workout.exercises.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({
        ...s,
        targetReps: s.targetReps || s.reps, 
        reps: "", 
        completed: false
      }))
    }));
    onSave({
      name: workout.name, 
      exercises: cleanedExercises 
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <TextInput 
            style={[styles.screenTitle, { marginBottom: 0, flex: 1, marginRight: 15, borderBottomWidth: 1, borderColor: '#ccc' }]} 
            value={workout.name}
            onChangeText={(text) => dispatch({ type: 'UPDATE_NAME', payload: text })}
            multiline
          />
          <TouchableOpacity onPress={handleCancelPress} style={{ padding: 5 }}>
            <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
        {workout.exercises.length === 0 && (
          <Text style={{ textAlign:'center', color:'#999', marginTop:40 }}>Tap + Add Exercise to build template</Text>
        )}
        {workout.exercises.map((ex, index) => (
          <ExerciseCard 
            key={ex.id} 
            exercise={ex} 
            exIndex={index} 
            dispatch={dispatch} 
            themePrimary={themePrimary} 
            themeSecondary={themeSecondary} 
            isEditingTemplate={true} 
          />
        ))}
        <TouchableOpacity 
          style={[styles.addExBtn, { borderColor: themeSecondary }]} 
          onPress={() => setShowPicker(true)}
        >
          <Text style={[styles.addExText, { color: themeSecondary }]}>+ Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity 
        style={[styles.finishBtn, { backgroundColor: themePrimary }]} 
        onPress={handleSavePress}
      >
        <Text style={[styles.finishText, styles.textOutline]}>SAVE TEMPLATE</Text>
      </TouchableOpacity>
      <ExercisePicker 
        visible={showPicker} 
        onClose={() => setShowPicker(false)} 
        onSelect={(item) => { 
          dispatch({ type: 'ADD_EXERCISE', payload: { name: item.name, category: item.category } }); 
          setShowPicker(false); 
        }} 
        exerciseDB={exerciseDB} 
        themePrimary={themePrimary} 
        themeSecondary={themeSecondary} 
        onAddCustom={onAddCustomExercise} 
        onUpdateCustom={onUpdateCustomExercise} 
        onDeleteCustom={onDeleteCustomExercise} 
      />
    </KeyboardAvoidingView>
  );
};


// D. SOCIAL 
const SocialScreen = ({ userInfo, themePrimary, themeSecondary }) => {
  const [liveUsers, setLiveUsers] = useState([]);
  const [loadingRank, setLoadingRank] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('global'); 
  const [friendCodes, setFriendCodes] = useState([]);
  const [newFriendInput, setNewFriendInput] = useState('');

  useEffect(() => {
    const loadFriends = async () => {
      const savedFriends = await AsyncStorage.getItem('FRIEND_CODES');
      if (savedFriends) setFriendCodes(JSON.parse(savedFriends));
    };
    loadFriends();
    fetchRankings();
  }, [viewMode, friendCodes]); 

  const fetchRankings = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = [];
      
      querySnapshot.forEach((document) => {
        const data = document.data();
        usersList.push({
          id: data.friendCode,
          name: data.name || "Unknown",
          school: data.school || "Unknown",
          xp: data.totalXP || 0,
          code: data.friendCode || "",
          isMe: data.friendCode === userInfo.friendCode
        });
      });

      let sortedBoard = usersList.sort((a, b) => b.xp - a.xp);
      
      if (viewMode === 'friends') {
        sortedBoard = sortedBoard.filter(user => 
          user.isMe || friendCodes.includes(user.code)
        );
      }
      setLiveUsers(sortedBoard);
    } catch (error) { 
      console.error("Error fetching leaderboard:", error); 
    } finally {
      setLoadingRank(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRankings();
    setRefreshing(false);
  };

  const handleAddFriend = async () => {
    if (!newFriendInput.trim()) return;
    const upperCode = newFriendInput.trim().toUpperCase();
    if (friendCodes.includes(upperCode) || upperCode === userInfo.friendCode) {
      Alert.alert("Oops", "You already added this person (or it's you)!");
      return;
    }
    const newFriendsList = [...friendCodes, upperCode];
    setFriendCodes(newFriendsList);
    await AsyncStorage.setItem('FRIEND_CODES', JSON.stringify(newFriendsList));
    setNewFriendInput('');
    Alert.alert("Added!", `Friend code ${upperCode} added.`);
  };

  return (
    <View style={{ flex: 1, padding: 20, paddingBottom: 0 }}>
      <Text style={styles.screenTitle}>Live Campus Rank</Text>
      <View style={styles.segmentedControl}>
        <TouchableOpacity 
          style={[styles.segmentBtn, viewMode === 'global' && {backgroundColor: themePrimary}]}
          onPress={() => { setLoadingRank(true); setViewMode('global'); }}
        >
          <Text style={[styles.segmentText, viewMode === 'global' && {color: 'white'}]}>Global</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.segmentBtn, viewMode === 'friends' && {backgroundColor: themePrimary}]}
          onPress={() => { setLoadingRank(true); setViewMode('friends'); }}
        >
          <Text style={[styles.segmentText, viewMode === 'friends' && {color: 'white'}]}>Friends Only</Text>
        </TouchableOpacity>
      </View>
      {viewMode === 'friends' && (
        <View style={{flexDirection: 'row', marginBottom: 15, gap: 10}}>
          <TextInput 
            style={[styles.input, {flex: 1}]} 
            placeholder="Enter Friend Code (e.g. A1B2C)" 
            value={newFriendInput}
            onChangeText={setNewFriendInput}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={[styles.addSetBtn, {backgroundColor: themeSecondary, marginTop: 0}]} onPress={handleAddFriend}>
            <Text style={{color: 'white', fontWeight: 'bold'}}>Add</Text>
          </TouchableOpacity>
        </View>
      )}
      {loadingRank ? (
        <ActivityIndicator size="large" color={themePrimary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList 
          data={liveUsers} 
          keyExtractor={item => item.id} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 20}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeSecondary} colors={[themeSecondary]} />}
          renderItem={({ item, index }) => (
            <View style={[styles.rankRow, item.isMe && { backgroundColor: themeSecondary + '10', borderColor: themeSecondary, borderWidth: 1 }]}>
              <Text style={[styles.rankNumber, index < 3 && { color: themeSecondary }]}>#{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rankName, item.isMe && { color: themeSecondary }]}>{item.name}</Text>
                <Text style={styles.rankSchool}>{item.school}</Text>
              </View>
              <Text style={styles.rankXP}>{item.xp.toLocaleString()} XP</Text>
            </View>
          )}
          ListEmptyComponent={
            viewMode === 'friends' ? 
            <Text style={{textAlign: 'center', color: '#999', marginTop: 20}}>Add some friend codes to see them here!</Text> : null
          }
        />
      )}
    </View>
  );
};

// E. PROFILE 
const ProfileScreen = ({ userStats, history, userInfo, onReset, onDeleteHistory, themePrimary, themeSecondary }) => {
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const recentHistory = history.slice(0, 7).reverse(); 
  const maxChartVolume = Math.max(...recentHistory.map(w => w.volume), 1); 

  const renderHistoryModal = () => {
    if (!selectedWorkout) return null;
    return (
      <Modal transparent visible={!!selectedWorkout} animationType="slide">
        <View style={styles.historyModalOverlay}>
          <View style={styles.historyModalCard}>
            <View style={styles.historyModalHeader}>
              <Text style={styles.historyModalTitle} numberOfLines={1}>{selectedWorkout.name}</Text>
              <TouchableOpacity onPress={() => setSelectedWorkout(null)} style={{ padding: 5 }}>
                <Text style={styles.closeTextBlack}>Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.historyModalDate}>{selectedWorkout.date} • {selectedWorkout.volume} lbs volume</Text>
            <ScrollView style={{ marginTop: 20 }} showsVerticalScrollIndicator={false}>
              {selectedWorkout.exercises && selectedWorkout.exercises.map((ex, i) => (
                <View key={i} style={[styles.historyExCard, { borderColor: themeSecondary + '40' }]}>
                  <Text style={styles.historyExName}>{ex.name}</Text>
                  {ex.sets.map((set, sIndex) => (
                    <View key={sIndex} style={styles.historySetRow}>
                      <Text style={styles.historySetText}>Set {sIndex + 1}</Text>
                      <Text style={styles.historySetDetails}>
                        {set.completed ? '✅' : '❌'} {set.weightLbs || 0} {ex.category === 'Cardio' ? 'mins' : 'lbs'} × {set.reps || 0} {ex.category === 'Cardio' ? 'dist' : 'reps'}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
              {!selectedWorkout.exercises && (
                <Text style={{ textAlign: 'center', color: '#999', marginTop: 30, fontStyle: 'italic' }}>
                  Detailed exercise data wasn't saved for this older session.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <View style={{ alignItems: 'center', marginBottom: 30 }}>
        <View style={[styles.avatar, { backgroundColor: themePrimary + '15' }]}>
          <Text style={{ fontSize: 35 }}>🎓</Text>
        </View>
        <Text style={styles.screenTitle}>{userInfo.name}</Text>
        <Text style={{ color: themeSecondary, fontWeight: 'bold', fontSize: 16 }}>{userInfo.school} • Level {userStats.level}</Text>
        <View style={{backgroundColor: '#eee', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginTop: 10}}>
          <Text style={{fontWeight: 'bold', color: '#666'}}>Friend Code: {userInfo.friendCode || 'NONE'}</Text>
        </View>
      </View>
      <Text style={styles.sectionHeader}>Lifetime Stats</Text>
      <View style={styles.grid}>
        <View style={[styles.statSquare, { borderColor: themePrimary + '20', borderWidth: 1 }]}>
          <Text style={styles.statEmoji}>🏋️</Text>
          <Text style={styles.statNumber}>{(userStats.totalVolume / 1000).toFixed(1)}k</Text>
          <Text style={styles.statSub}>Lbs Lifted</Text>
        </View>
        <View style={[styles.statSquare, { borderColor: themePrimary + '20', borderWidth: 1 }]}>
          <Text style={styles.statEmoji}>📅</Text>
          <Text style={styles.statNumber}>{userStats.workoutsCompleted}</Text>
          <Text style={styles.statSub}>Sessions</Text>
        </View>
        <View style={[styles.statSquare, { borderColor: themePrimary + '20', borderWidth: 1 }]}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statNumber}>{userStats.weekStreak}</Text>
          <Text style={styles.statSub}>Wk Streak</Text>
        </View>
      </View>
      <Text style={styles.sectionHeader}>Achievements</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 20, paddingBottom: 10 }}>
        {BADGES.map(b => {
          const earned = b.condition(userStats);
          return (
            <View key={b.id} style={[styles.badgeCard, !earned && { opacity: 0.4, backgroundColor: '#eee' }, earned && {borderColor: themeSecondary, borderWidth: 1}]}>
              <Text style={styles.badgeIcon}>{b.icon}</Text>
              <Text style={[styles.badgeName, earned && {color: themePrimary}]}>{b.name}</Text>
            </View>
          )
        })}
      </ScrollView>
      {recentHistory.length > 0 && (
        <View style={{marginTop: 10, marginBottom: 20}}>
          <Text style={styles.sectionHeader}>Volume History</Text>
          <View style={styles.chartContainer}>
            {recentHistory.map((w, index) => {
              const barHeightPercentage = Math.max((w.volume / maxChartVolume) * 100, 5); 
              return (
                <View key={index} style={styles.chartCol}>
                  <View style={styles.chartBarBg}>
                    <View style={[styles.chartBarFill, { height: `${barHeightPercentage}%`, backgroundColor: themeSecondary }]} />
                  </View>
                  <Text style={styles.chartDateLabel}>{w.date.substring(0, 5)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
      <Text style={styles.sectionHeader}>Recent History (Long Press to Delete)</Text>
      {history.length === 0 && <Text style={{ color: '#999' }}>No workouts finished yet!</Text>}
      {history.slice(0, 10).map((w, i) => (
        <TouchableOpacity 
          key={i} 
          style={[styles.historyItemAction, { borderColor: themeSecondary + '20', borderWidth: 1 }]} 
          onPress={() => setSelectedWorkout(w)}
          onLongPress={() => {
            Alert.alert("Delete Workout", "Are you sure you want to remove this from your history?", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => onDeleteHistory(i) }
            ]);
          }}
        >
          <View style={styles.historyItemLeft}>
            <View style={[styles.historyIconBg, { backgroundColor: themeSecondary + '15' }]}>
              <Text style={{ fontSize: 20 }}>💪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyName} numberOfLines={2}>{w.name}</Text>
              <Text style={styles.historyDate}>{w.date} • {w.volume} lbs</Text>
            </View>
          </View>
          <View style={styles.historyItemRight}>
            <View style={[styles.xpBadge, { backgroundColor: themeSecondary + '20' }]}>
              <Text style={[styles.xpBadgeText, { color: themeSecondary }]}>+{w.xpEarned} XP</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={onReset} style={{ marginTop: 40, padding: 15, alignItems: 'center' }}>
        <Text style={{ color: '#ff4444', fontWeight: 'bold' }}>Reset Profile</Text>
      </TouchableOpacity>
      {renderHistoryModal()}
    </ScrollView>
  );
};

// --- F: AI COACH CHAT SCREEN ---
const AICoachScreen = ({ themePrimary, themeSecondary, onImportPlan }) => {
  const initialMessage = { id: '1', role: 'ai', text: "Hey! I'm Coach AI. Ask me a fitness question, or tell me your goals to build a custom routine!" };
  const [messages, setMessages] = useState([initialMessage]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef(null);

  const handleClearChat = () => {
    Alert.alert(
      "Clear Chat", 
      "Are you sure?", 
      [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => setMessages([initialMessage]) }]
    );
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userText = inputText.trim();
    const newUserMsg = { id: Date.now().toString(), role: 'user', text: userText };
    const currentChatHistory = [...messages, newUserMsg];
    setMessages(currentChatHistory);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch(`${SERVER_URL}/chat`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true' 
        },
        body: JSON.stringify({ 
          messages: currentChatHistory.map(m => ({ 
            role: m.role, 
            text: m.text 
          })) 
        })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const aiResponse = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: typeof data.text === 'object' ? data.text.text : (data.text || "Response received."), 
        workoutPlan: data.workoutPlan || null 
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error("Coach AI Error:", error);
      Alert.alert(
        "Coach Connection", 
        "Check that localtunnel is running and SERVER_URL is updated. First load can take 60s."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = (aiPlan) => {
    const newTemplatesArray = aiPlan.schedule.map(day => {
      const mappedExercises = day.exercises.map(ex => ({
        id: Math.random().toString(), 
        name: ex.name, 
        category: ex.category || 'Other', 
        sets: Array.from({ length: ex.sets }).map(() => ({ 
          id: Math.random().toString(), 
          reps: "", 
          targetReps: ex.reps, 
          weightLbs: "", 
          completed: false 
        }))
      }));
      return { name: `${aiPlan.plan_name} - ${day.day_name}`, exercises: mappedExercises };
    });
    onImportPlan(newTemplatesArray);
  };

  const renderMessage = ({ item }) => {
    const isAI = item.role === 'ai';
    return (
      <View style={[styles.msgWrapper, isAI ? styles.msgAI : styles.msgUser]}>
        <View style={[styles.msgBubble, isAI ? styles.bubbleAI : { backgroundColor: themeSecondary }]}>
          <Text style={[styles.msgText, isAI ? styles.textAI : [styles.textUser, styles.textOutline]]}>
            {item.text}
          </Text>
        </View>
        {item.workoutPlan && (
          <View style={[styles.planCard, { borderColor: themeSecondary, borderWidth: 1 }]}>
            <Text style={styles.planCardTitle}>{item.workoutPlan.plan_name}</Text>
            <Text style={styles.planCardSub}>{item.workoutPlan.description}</Text>
            {item.workoutPlan.schedule.map((day, dayIndex) => (
              <View key={dayIndex} style={styles.planCardPreview}>
                <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>{day.day_name}</Text>
                {day.exercises.map((ex, i) => {
                  const isCardio = ex.category === 'Cardio';
                  const setString = isCardio ? `${ex.sets} intervals` : `${ex.sets}x${ex.reps}`;
                  const distString = isCardio ? ` (${ex.reps})` : '';
                  return (
                    <Text key={i} style={styles.previewText}>• {setString} {ex.name}{distString}</Text>
                  );
                })}
              </View>
            ))}
            <TouchableOpacity 
              style={[styles.importBtn, { backgroundColor: themePrimary }]} 
              onPress={() => handleImport(item.workoutPlan)}
            >
              <Text style={[styles.importBtnText, styles.textOutline]}>📥 Save Full Split to Home</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={{ flex: 1 }} 
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={{ padding: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.screenTitle, { marginBottom: 0 }]}>Coach AI</Text>
        <TouchableOpacity onPress={handleClearChat} style={styles.clearChatBtn}>
          <Text style={styles.clearChatText}>Clear</Text>
        </TouchableOpacity>
      </View>
      <FlatList 
        ref={flatListRef} 
        data={messages} 
        keyExtractor={item => item.id} 
        renderItem={renderMessage} 
        contentContainerStyle={{ padding: 20 }} 
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()} 
      />
      {isLoading && <ActivityIndicator style={{ marginBottom: 10 }} color={themeSecondary} />}
      <View style={styles.chatInputContainer}>
        <TextInput 
          style={styles.chatInput} 
          placeholder="Ask for a workout..." 
          value={inputText} 
          onChangeText={setInputText} 
          multiline 
          editable={!isLoading} 
        />
        <TouchableOpacity 
          style={[styles.sendBtn, { backgroundColor: themeSecondary }]} 
          onPress={handleSend} 
          disabled={isLoading}
        >
          <Text style={[{ color: 'white', fontWeight: 'bold' }, styles.textOutline]}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// --- 8. UTILS ---
const ExercisePicker = ({ visible, onClose, onSelect, exerciseDB, themePrimary, themeSecondary, onAddCustom, onUpdateCustom, onDeleteCustom }) => {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Chest');
  const filtered = exerciseDB.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase()));

  const handleClose = () => { 
    setIsAdding(false); 
    setEditingId(null); 
    setSearch(''); 
    setNewName(''); 
    onClose(); 
  };
  const handleOpenCreate = () => { 
    setEditingId(null); 
    setNewName(''); 
    setNewCategory('Chest'); 
    setIsAdding(true); 
  };
  const handleOpenEdit = (item) => { 
    setEditingId(item.id); 
    setNewName(item.name); 
    setNewCategory(CATEGORIES.includes(item.category) ? item.category : 'Other'); 
    setIsAdding(true); 
  };
  const handleSave = () => {
    if (!newName.trim()) return Alert.alert("Hold on", "Please enter an exercise name!");
    if (editingId) { 
      onUpdateCustom(editingId, newName.trim(), newCategory); 
    } else { 
      onAddCustom({ name: newName.trim(), category: newCategory }); 
      onSelect({ name: newName.trim(), category: newCategory }); 
    }
    setNewName(''); 
    setSearch(''); 
    setEditingId(null); 
    setIsAdding(false);
  };
  const handleDelete = () => {
    Alert.alert("Delete Exercise", "Are you sure?", [
      { text: "Cancel", style: "cancel" }, 
      { text: "Delete", style: "destructive", onPress: () => { onDeleteCustom(editingId); setIsAdding(false); setEditingId(null); } }
    ]);
  };

  return (
    <Modal animationType="slide" visible={visible} presentationStyle="pageSheet">
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{editingId ? "Edit" : (isAdding ? "Create" : "Choose Exercise")}</Text>
          <TouchableOpacity onPress={handleClose}><Text style={styles.closeTextBlack}>Close</Text></TouchableOpacity>
        </View>
        {!isAdding ? (
          <>
            <TextInput style={styles.searchBar} placeholder="Search..." value={search} onChangeText={setSearch} />
            <TouchableOpacity style={styles.createBtn} onPress={handleOpenCreate}><Text style={{ color: themeSecondary, fontWeight: 'bold' }}>+ Create Custom</Text></TouchableOpacity>
            <FlatList 
              data={filtered} 
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.pickerItemRow}>
                  <TouchableOpacity style={{ flex: 1, padding: 16 }} onPress={() => onSelect(item)}>
                    <Text style={styles.pickerItemText}>{item.name}</Text>
                    <Text style={styles.pickerItemSub}>{item.category}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ padding: 16 }} onPress={() => handleOpenEdit(item)}><Text style={{ color: themeSecondary, fontWeight: 'bold' }}>EDIT</Text></TouchableOpacity>
                </View>
              )}
            />
          </>
        ) : (
          <View style={{ padding: 20 }}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={[styles.onboardingInput, { marginBottom: 20 }]} placeholder="e.g. Sled Push" value={newName} onChangeText={setNewName} />
            <Text style={styles.label}>Muscle Group</Text>
            <ScrollView horizontal style={{ marginBottom: 30 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} style={[styles.categoryPill, newCategory === cat && { backgroundColor: themeSecondary }]} onPress={() => setNewCategory(cat)}>
                  <Text style={[styles.categoryPillText, newCategory === cat && { color: 'white' }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.bigStartBtn, { backgroundColor: themePrimary }]} onPress={handleSave}><Text style={[styles.bigStartText, styles.textOutline]}>{editingId ? "UPDATE" : "SAVE"}</Text></TouchableOpacity>
            {editingId && <TouchableOpacity style={{ marginTop: 20 }} onPress={handleDelete}><Text style={{ color: 'red', fontWeight: 'bold', textAlign: 'center' }}>Delete</Text></TouchableOpacity>}
            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => { setIsAdding(false); setEditingId(null); }}><Text style={{ color: '#999', textAlign: 'center' }}>Cancel</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

// --- 9. MAIN ORCHESTRATOR ---
export default function App() {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('ONBOARDING');
  const [userInfo, setUserInfo] = useState({ name: '', school: '', friendCode: '' });
  const [themeColors, setThemeColors] = useState({ primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY });
  const [importedWorkoutData, setImportedWorkoutData] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState([]); 
  const [editingTemplateIndex, setEditingTemplateIndex] = useState(null);
  const [exerciseDB, setExerciseDB] = useState(DEFAULT_EXERCISES);
  const [stats, setStats] = useState({ level: 1, currentXP: 0, weekStreak: 0, workoutsThisWeek: 0, lastWeekStart: null, rank: 99, totalVolume: 0, workoutsCompleted: 0 });
  const [history, setHistory] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [lastData, setLastData] = useState(null);
  const [bonusMessage, setBonusMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedUser = await AsyncStorage.getItem('USER_INFO');
        const savedStats = await AsyncStorage.getItem('USER_STATS');
        const savedHistory = await AsyncStorage.getItem('USER_HISTORY');
        const savedColors = await AsyncStorage.getItem('THEME_COLORS_OBJ'); 
        const savedTmpls = await AsyncStorage.getItem('SAVED_TEMPLATES'); 
        const savedDB = await AsyncStorage.getItem('CUSTOM_EXERCISES'); 
        if (savedUser) {
          let parsedUser = JSON.parse(savedUser);
          if (!parsedUser.friendCode) parsedUser.friendCode = generateFriendCode();
          setUserInfo(parsedUser);
          if (savedStats) setStats(JSON.parse(savedStats));
          if (savedHistory) setHistory(JSON.parse(savedHistory));
          if (savedColors) setThemeColors(JSON.parse(savedColors)); 
          if (savedTmpls) setSavedTemplates(JSON.parse(savedTmpls));
          if (savedDB) setExerciseDB(JSON.parse(savedDB)); 
          setScreen('HOME');
        }
      } catch (e) { console.log('Failed to load'); } finally { setLoading(false); }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      AsyncStorage.setItem('USER_STATS', JSON.stringify(stats));
      AsyncStorage.setItem('USER_HISTORY', JSON.stringify(history));
    }
  }, [stats, history, loading]);

  const handleOnboardingComplete = async (name, school, colors, generatedCode) => {
    const newUser = { name, school, friendCode: generatedCode };
    setUserInfo(newUser);
    setThemeColors(colors);
    
    try {
      await setDoc(doc(db, "users", generatedCode), {
        name: name,
        school: school,
        friendCode: generatedCode,
        totalXP: 0
      });
    } catch (e) {
      console.error("Error creating user profile:", e);
    }

    await AsyncStorage.setItem('USER_INFO', JSON.stringify(newUser));
    await AsyncStorage.setItem('THEME_COLORS_OBJ', JSON.stringify(colors)); 
    setScreen('HOME');
  };

  const handleReset = async () => { await AsyncStorage.clear(); Alert.alert("Reset", "Please restart app."); };
  
  const handleFinish = async (data) => {
    const today = new Date();
    const currentWeekStart = getWeekStart(today); 
    let { weekStreak, lastWeekStart, workoutsThisWeek } = stats;
    let xpBonus = 0; let bonusMsg = "";
    if (currentWeekStart !== lastWeekStart) {
      workoutsThisWeek = 1; weekStreak = lastWeekStart ? (((new Date(currentWeekStart) - new Date(lastWeekStart)) / 86400000 <= 7) ? weekStreak + 1 : 1) : 1;
      lastWeekStart = currentWeekStart;
    } else {
      workoutsThisWeek += 1;
      if (workoutsThisWeek === 2) { xpBonus = 25; bonusMsg = "Grind Bonus!"; }
      else if (workoutsThisWeek === 3) { xpBonus = 50; bonusMsg = "Consistency!"; }
    }
    const finalXP = data.xpEarned + xpBonus;
    
    try {
      await addDoc(collection(db, "workouts"), { 
        user_name: userInfo.name, 
        user_school: userInfo.school, 
        user_code: userInfo.friendCode, 
        workout_name: data.name, 
        total_volume: data.volume, 
        xp_earned: finalXP, 
        createdAt: serverTimestamp() 
      });
      
      await updateDoc(doc(db, "users", userInfo.friendCode), {
        totalXP: stats.currentXP + finalXP
      });
    } catch (e) { console.error("Cloud Error:", e); }

    setStats(prev => ({ ...prev, currentXP: prev.currentXP + finalXP, totalVolume: prev.totalVolume + data.volume, workoutsCompleted: prev.workoutsCompleted + 1, weekStreak, workoutsThisWeek, lastWeekStart }));
    setHistory(prev => [{ ...data, xpEarned: finalXP }, ...prev]);
    setLastData({ ...data, xpEarned: finalXP });
    setBonusMessage(bonusMsg);
    setImportedWorkoutData(null); 
    setShowSummary(true);
    setScreen('SOCIAL'); 
  };

  const handleDeleteHistoryItem = (index) => {
    const updated = [...history]; updated.splice(index, 1); setHistory(updated);
    AsyncStorage.setItem('USER_HISTORY', JSON.stringify(updated));
  };
  const handleImportPlan = (formatted) => {
    const newTemplates = [...savedTemplates, ...formatted];
    setSavedTemplates(newTemplates);
    AsyncStorage.setItem('SAVED_TEMPLATES', JSON.stringify(newTemplates));
    Alert.alert("Success", `${formatted.length} workouts saved!`, [{ text: "OK", onPress: () => setScreen('HOME') }]);
  };
  const handleAddCustomExercise = (newEx) => {
    const newDb = [...exerciseDB, { id: 'custom_' + Date.now(), name: newEx.name, category: newEx.category }].sort((a,b) => a.name.localeCompare(b.name));
    setExerciseDB(newDb); AsyncStorage.setItem('CUSTOM_EXERCISES', JSON.stringify(newDb));
  };
  const handleUpdateCustomExercise = (id, n, c) => {
    const dbNew = exerciseDB.map(ex => ex.id === id ? { ...ex, name: n, category: c } : ex).sort((a,b) => a.name.localeCompare(b.name));
    setExerciseDB(dbNew); AsyncStorage.setItem('CUSTOM_EXERCISES', JSON.stringify(dbNew));
  };
  const handleDeleteCustomExercise = (id) => { setExerciseDB(prev => prev.filter(ex => ex.id !== id)); };
  const handleStartTemplate = (t) => { setImportedWorkoutData(t); setScreen('WORKOUT'); };
  const handleOpenEditTemplate = (t, i) => { setImportedWorkoutData(t); setEditingTemplateIndex(i); setScreen('EDIT_TEMPLATE'); };
  const handleSaveEditedTemplate = (upd) => {
    const arr = [...savedTemplates]; arr[editingTemplateIndex] = upd;
    setSavedTemplates(arr); AsyncStorage.setItem('SAVED_TEMPLATES', JSON.stringify(arr));
    setImportedWorkoutData(null); setEditingTemplateIndex(null); setScreen('HOME');
  };
  const handleDeleteTemplate = (i) => {
    Alert.alert("Delete?", "Remove template?", [{ text: "Cancel" }, { text: "Delete", onPress: () => {
      const upd = savedTemplates.filter((_, idx) => idx !== i);
      setSavedTemplates(upd); AsyncStorage.setItem('SAVED_TEMPLATES', JSON.stringify(upd));
    }}]);
  };
  const handleShareWorkout = async () => {
    try { await Share.share({ message: `I finished my ${lastData?.name} on CampusFit! 🎓 I lifted ${lastData?.volume.toLocaleString()} lbs and earned ${lastData?.xpEarned} XP! Code: ${userInfo.friendCode}` }); } catch (e) { console.log(e); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  if (screen === 'ONBOARDING') return <SafeAreaView style={styles.container}><OnboardingScreen onComplete={handleOnboardingComplete} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        {screen === 'HOME' && <HomeScreen userStats={stats} userInfo={userInfo} onStartWorkout={() => { setImportedWorkoutData(null); setScreen('WORKOUT'); }} themePrimary={themeColors.primary} themeSecondary={themeColors.secondary} savedTemplates={savedTemplates} onStartTemplate={handleStartTemplate} onEditTemplate={handleOpenEditTemplate} onDeleteTemplate={handleDeleteTemplate} />}
        {screen === 'WORKOUT' && <ActiveWorkoutScreen onFinish={handleFinish} onCancel={() => { setImportedWorkoutData(null); setScreen('HOME'); }} themePrimary={themeColors.primary} themeSecondary={themeColors.secondary} initialData={importedWorkoutData} exerciseDB={exerciseDB} onAddCustomExercise={handleAddCustomExercise} onUpdateCustomExercise={handleUpdateCustomExercise} onDeleteCustomExercise={handleDeleteCustomExercise} />}
        {screen === 'EDIT_TEMPLATE' && <EditTemplateScreen onSave={handleSaveEditedTemplate} onCancel={() => { setImportedWorkoutData(null); setEditingTemplateIndex(null); setScreen('HOME'); }} themePrimary={themeColors.primary} themeSecondary={themeColors.secondary} initialData={importedWorkoutData} exerciseDB={exerciseDB} onAddCustomExercise={handleAddCustomExercise} onUpdateCustomExercise={handleUpdateCustomExercise} onDeleteCustomExercise={handleDeleteCustomExercise} />}
        {screen === 'COACH' && <AICoachScreen themePrimary={themeColors.primary} themeSecondary={themeColors.secondary} onImportPlan={handleImportPlan} />}
        {screen === 'SOCIAL' && <SocialScreen userInfo={userInfo} themePrimary={themeColors.primary} themeSecondary={themeColors.secondary} />}
        {screen === 'PROFILE' && <ProfileScreen userStats={stats} history={history} userInfo={userInfo} onReset={handleReset} onDeleteHistory={handleDeleteHistoryItem} themePrimary={themeColors.primary} themeSecondary={themeColors.secondary} />}
      </View>
      {(screen !== 'WORKOUT' && screen !== 'EDIT_TEMPLATE') && (
        <View style={styles.tabBar}>
          <TouchableOpacity onPress={() => setScreen('HOME')} style={styles.tabItem}><Text style={[styles.tabText, screen === 'HOME' && { color: themeColors.primary, fontWeight: 'bold' }]}>🏠 Home</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('COACH')} style={styles.tabItem}><Text style={[styles.tabText, screen === 'COACH' && { color: themeColors.primary, fontWeight: 'bold' }]}>🤖 Coach</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('SOCIAL')} style={styles.tabItem}><Text style={[styles.tabText, screen === 'SOCIAL' && { color: themeColors.primary, fontWeight: 'bold' }]}>🏆 Rank</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('PROFILE')} style={styles.tabItem}><Text style={[styles.tabText, screen === 'PROFILE' && { color: themeColors.primary, fontWeight: 'bold' }]}>👤 You</Text></TouchableOpacity>
        </View>
      )}
      {showSummary && (
        <Modal transparent visible={showSummary}>
          <View style={summaryStyles.overlay}>
            <View style={summaryStyles.modal}>
              <Text style={summaryStyles.header}>WORKOUT COMPLETE</Text>
              <Text style={[summaryStyles.bigXP, { color: themeColors.primary }, styles.textOutline]}>+{lastData?.xpEarned} XP</Text>
              {bonusMessage !== "" && <Text style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: 10 }}>{bonusMessage}</Text>}
              <Text style={{ color: '#666', marginBottom: 20 }}>Streak: {stats.weekStreak} 🔥</Text>
              <View style={{flexDirection: 'row', gap: 10, width: '100%'}}>
                <TouchableOpacity style={[summaryStyles.shareBtn, { backgroundColor: themeColors.secondary, flex: 1 }]} onPress={handleShareWorkout}><Text style={[summaryStyles.closeText, styles.textOutline]}>SHARE</Text></TouchableOpacity>
                <TouchableOpacity style={[summaryStyles.closeBtn, { backgroundColor: themeColors.primary, flex: 1 }]} onPress={() => setShowSummary(false)}><Text style={[summaryStyles.closeText, styles.textOutline]}>RANKING</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// --- 10. STYLESHEET ---
const styles = StyleSheet.create({
  textOutline: {
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  container: { 
    flex: 1, 
    backgroundColor: '#f2f2f7', 
    paddingTop: 40 
  },
  screenTitle: { 
    fontSize: 28, 
    fontWeight: '800', 
    marginBottom: 20, 
    color: '#000' 
  },
  sectionHeader: { 
    fontSize: 20, 
    fontWeight: '700', 
    marginTop: 20, 
    marginBottom: 10, 
    color: '#333' 
  },
  onboardingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20 
  },
  onboardingCard: { 
    backgroundColor: 'white', 
    padding: 30, 
    borderRadius: 20, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 20 
  },
  onboardingTitle: { 
    fontSize: 26, 
    fontWeight: '900', 
    textAlign: 'center', 
    marginBottom: 10 
  },
  onboardingSub: { 
    textAlign: 'center', 
    color: '#666', 
    marginBottom: 30, 
    fontSize: 16 
  },
  inputGroup: { 
    marginBottom: 20 
  },
  label: { 
    fontWeight: 'bold', 
    marginBottom: 8, 
    color: '#333' 
  },
  onboardingInput: { 
    backgroundColor: '#f5f5f5', 
    padding: 16, 
    borderRadius: 12, 
    fontSize: 16 
  },
  levelCard: { 
    backgroundColor: 'white', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 20 
  },
  levelRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10 
  },
  levelLabel: {
    fontWeight: 'bold'
  },
  levelRank: {
    fontWeight: 'bold'
  },
  progressBarBg: { 
    height: 10, 
    backgroundColor: '#eee', 
    borderRadius: 5, 
    marginBottom: 8 
  },
  progressBarFill: { 
    height: '100%',
    borderRadius: 5
  },
  xpText: { 
    textAlign: 'right', 
    color: '#999', 
    fontSize: 12 
  },
  grid: { 
    flexDirection: 'row', 
    gap: 10, 
    marginBottom: 10 
  },
  statSquare: { 
    flex: 1, 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  statEmoji: { 
    fontSize: 30, 
    marginBottom: 5 
  }, 
  statNumber: { 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  statSub: { 
    fontSize: 12, 
    color: '#999', 
    textAlign: 'center' 
  },
  badgeCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    width: 100,
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 5, 
    shadowOffset: { width: 0, height: 2 }, 
  },
  badgeIcon: {
    fontSize: 30,
    marginBottom: 5
  },
  badgeName: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#666'
  },
  bigStartBtn: { 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginTop: 10, 
    backgroundColor: '#000' 
  }, 
  bigStartText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 18 
  },
  rankRow: { 
    flexDirection: 'row', 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10, 
    alignItems: 'center' 
  },
  rankNumber: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    width: 40, 
    color: '#999' 
  },
  rankName: { 
    fontSize: 16, 
    fontWeight: '600' 
  },
  rankXP: { 
    fontWeight: 'bold', 
    color: '#333' 
  },
  rankSchool: { 
    fontSize: 12, 
    color: '#999' 
  },
  tabBar: { 
    flexDirection: 'row', 
    backgroundColor: 'white', 
    paddingBottom: 20, 
    paddingTop: 15, 
    borderTopWidth: 1, 
    borderColor: '#eee' 
  },
  tabItem: { 
    flex: 1, 
    alignItems: 'center' 
  },
  tabText: { 
    color: '#999' 
  },
  card: { 
    backgroundColor: 'white', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 12 
  },
  title: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    flex: 1, 
    marginRight: 10 
  },
  deleteBtn: { 
    width: 30, 
    height: 30, 
    backgroundColor: '#ffebee', 
    borderRadius: 15, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: -2 
  },
  deleteText: { 
    color: '#d32f2f', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  rowHeader: { 
    flexDirection: 'row', 
    marginBottom: 8 
  },
  colLabel: { 
    flex: 1, 
    fontSize: 10, 
    color: '#999', 
    textAlign: 'center' 
  },
  setRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8,
    borderRadius: 8,
    paddingVertical: 4
  },
  input: { 
    flex: 1, 
    backgroundColor: '#f5f5f5', 
    borderRadius: 8, 
    padding: 10, 
    marginHorizontal: 4, 
    textAlign: 'center' 
  },
  checkbox: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#eee', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginLeft: 8 
  },
  deleteSetBtn: { 
    width: 30, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginLeft: 8 
  },
  addSetBtn: { 
    marginTop: 8, 
    padding: 10, 
    alignItems: 'center', 
    borderRadius: 8 
  },
  addSetText: { 
    fontWeight: 'bold' 
  },
  addExBtn: { 
    padding: 15, 
    alignItems: 'center', 
    marginBottom: 80, 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: '#ccc', 
    borderRadius: 12 
  },
  addExText: { 
    color: '#999', 
    fontWeight: 'bold' 
  },
  finishBtn: { 
    position: 'absolute', 
    bottom: 30, 
    left: 20, 
    right: 20, 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    backgroundColor: '#000' 
  },
  finishText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 18 
  },
  timerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 20 
  },
  timerLabel: { 
    fontWeight: 'bold', 
    marginRight: 10, 
    color: '#333' 
  },
  timerInput: { 
    backgroundColor: '#f5f5f5', 
    borderRadius: 8, 
    padding: 10, 
    width: 60, 
    textAlign: 'center', 
    marginRight: 10 
  },
  timerBtn: { 
    flex: 1, 
    padding: 12, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  timerBtnText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  pickerContainer: { 
    flex: 1, 
    backgroundColor: 'white', 
    paddingTop: 20 
  },
  pickerHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 20 
  },
  pickerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  closeTextBlack: { 
    color: 'blue', 
    fontWeight: '600' 
  },
  searchBar: { 
    backgroundColor: '#f0f0f0', 
    margin: 15, 
    padding: 12, 
    borderRadius: 10 
  },
  pickerItemRow: { 
    flexDirection: 'row', 
    borderBottomWidth: 1, 
    borderColor: '#f5f5f5', 
    alignItems: 'center' 
  },
  pickerItemText: { 
    fontSize: 18 
  },
  pickerItemSub: { 
    fontSize: 14, 
    color: '#999' 
  },
  createBtn: { 
    padding: 15, 
    alignItems: 'center', 
    backgroundColor: '#f5f5f5', 
    borderRadius: 10, 
    marginHorizontal: 15, 
    marginBottom: 10 
  },
  categoryPill: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20, 
    backgroundColor: '#eee', 
    marginRight: 10 
  },
  categoryPillText: { 
    color: '#333', 
    fontWeight: '600' 
  },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 10 
  },
  historyItemAction: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 16, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 2 
  },
  historyItemLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1, 
    marginRight: 15 
  },
  historyIconBg: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  historyName: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    color: '#333' 
  },
  historyDate: { 
    color: '#999', 
    marginTop: 4, 
    fontSize: 13 
  },
  historyItemRight: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  chevron: { 
    fontSize: 24, 
    color: '#ccc', 
    marginLeft: 10, 
    marginBottom: 2 
  },
  xpBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  xpBadgeText: { 
    fontWeight: 'bold', 
    fontSize: 12 
  },
  historyModalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'flex-end' 
  },
  historyModalCard: { 
    backgroundColor: 'white', 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 25, 
    maxHeight: '80%', 
    minHeight: '50%' 
  },
  historyModalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  historyModalTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    flex: 1 
  },
  historyModalDate: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 5 
  },
  historyExCard: { 
    backgroundColor: '#f9f9f9', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#eee' 
  },
  historyExName: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginBottom: 8, 
    color: '#333' 
  },
  historySetRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 6, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  historySetText: { 
    color: '#666', 
    fontSize: 14 
  },
  historySetDetails: { 
    fontWeight: '600', 
    fontSize: 14, 
    color: '#333' 
  },
  calendarIcon: { 
    width: 36, 
    height: 36, 
    backgroundColor: '#fff', 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#ddd', 
    alignItems: 'center', 
    justifyContent: 'flex-start', 
    marginBottom: 5, 
    overflow: 'hidden' 
  },
  calendarHeader: { 
    width: '100%', 
    height: 10, 
    backgroundColor: '#FF3B30' 
  },
  calendarText: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#000', 
    marginTop: 2 
  },
  templateWrapper: { 
    position: 'relative', 
    marginBottom: 15 
  },
  templateCard: { 
    backgroundColor: 'white', 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#eee' 
  },
  templateName: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginBottom: 4, 
    color: '#333' 
  },
  templateSub: { 
    color: '#999', 
    fontSize: 12, 
    marginBottom: 12 
  },
  startTmplBtn: { 
    paddingVertical: 8, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  deleteTmplBtn: { 
    position: 'absolute', 
    top: -5, 
    right: -5, 
    zIndex: 10, 
    padding: 5, 
    backgroundColor: '#f0f0f0', 
    borderRadius: 15, 
    width: 28, 
    height: 28, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#ddd' 
  },
  deleteTmplText: { 
    color: '#666', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  msgWrapper: { 
    marginBottom: 15, 
    maxWidth: '85%' 
  },
  msgUser: { 
    alignSelf: 'flex-end' 
  },
  msgAI: { 
    alignSelf: 'flex-start' 
  },
  msgBubble: { 
    padding: 14, 
    borderRadius: 18 
  },
  bubbleAI: { 
    backgroundColor: '#e5e5ea', 
    borderBottomLeftRadius: 4 
  },
  textAI: { 
    color: '#000', 
    fontSize: 16 
  },
  textUser: { 
    color: '#fff', 
    fontSize: 16 
  },
  planCard: { 
    backgroundColor: 'white', 
    borderRadius: 16, 
    padding: 16, 
    marginTop: 10, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 }, 
    minWidth: '90%' 
  },
  planCardTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 4 
  },
  planCardSub: { 
    fontSize: 14, 
    color: '#666', 
    marginBottom: 12 
  },
  planCardPreview: { 
    backgroundColor: '#f9f9f9', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 12 
  },
  previewText: { 
    fontSize: 14, 
    color: '#333', 
    marginBottom: 4 
  },
  importBtn: { 
    padding: 12, 
    borderRadius: 10, 
    alignItems: 'center' 
  },
  importBtnText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  chatInputContainer: { 
    flexDirection: 'row', 
    padding: 10, 
    backgroundColor: 'white', 
    borderTopWidth: 1, 
    borderColor: '#eee', 
    alignItems: 'center' 
  },
  chatInput: { 
    flex: 1, 
    backgroundColor: '#f2f2f7', 
    padding: 12, 
    borderRadius: 20, 
    maxHeight: 100, 
    fontSize: 16 
  },
  sendBtn: { 
    marginLeft: 10, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 20 
  },
  clearChatBtn: { 
    padding: 8, 
    backgroundColor: '#ffebee', 
    borderRadius: 8 
  },
  clearChatText: { 
    color: '#d32f2f', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 150,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarBg: {
    width: 20,
    height: '80%',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 8,
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  chartDateLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: 'bold',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderRadius: 10,
    padding: 4,
    marginBottom: 15
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  segmentText: {
    fontWeight: 'bold',
    color: '#666'
  }
});

const summaryStyles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    padding: 20 
  },
  modal: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 24, 
    alignItems: 'center' 
  },
  header: { 
    fontSize: 20, 
    fontWeight: '900', 
    marginBottom: 20 
  },
  bigXP: { 
    fontSize: 40, 
    fontWeight: '900', 
    marginBottom: 10 
  },
  closeBtn: { 
    paddingVertical: 16, 
    borderRadius: 14, 
    alignItems: 'center' 
  },
  shareBtn: { 
    paddingVertical: 16, 
    borderRadius: 14, 
    alignItems: 'center' 
  },
  closeText: { 
    color: 'white', 
    fontWeight: 'bold' 
  }
});

export const firebaseDatabase = db;