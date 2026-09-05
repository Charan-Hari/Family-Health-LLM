import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ApiError,
  checkMedicationSafety,
  createAllergy,
  createFamilyMember,
  FamilyMember,
  getFamilyMembers,
  SafetyAlert,
  streamRecordAssistantReply,
  uploadPrescription,
} from './src/api';

type Screen = 'home' | 'review' | 'result' | 'assistant';
const isStaticDemo = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [allergyName, setAllergyName] = useState('');
  const [medicationName, setMedicationName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  useEffect(() => {
    if (!isStaticDemo) {
      void loadMembers();
    }
  }, []);

  async function loadMembers() {
    try {
      setMembers(await getFamilyMembers());
    } catch {
      setErrorMessage('Connect to the API to create a profile and run a safety check.');
    }
  }

  async function addFamilyMember() {
    if (!newMemberName.trim()) {
      setErrorMessage('Enter a name or a private label for this family member.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const member = await createFamilyMember(newMemberName.trim(), 'family');
      setMembers((current) => [member, ...current]);
      setSelectedMember(member);
      setNewMemberName('');
      if (allergyName.trim()) {
        try {
          await createAllergy(member.id, allergyName.trim());
        } catch (error) {
          setErrorMessage(`Profile created, but the allergy was not recorded: ${toMessage(error)}`);
          return;
        }
      }
      setAllergyName('');
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function choosePrescription(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Family Health LLM needs access only to select the prescription you choose.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setScreen('review');
      setErrorMessage('');
    }
  }

  async function reviewSafety() {
    if (!selectedMember) {
      setErrorMessage('Select or create a family member before checking a medication.');
      setScreen('home');
      return;
    }
    if (!medicationName.trim()) {
      setErrorMessage('Confirm the medication name from the prescription before continuing.');
      return;
    }
    if (!photoUri) {
      setErrorMessage('Select a prescription photo before continuing.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      await uploadPrescription(selectedMember.id, photoUri);
      const result = await checkMedicationSafety(selectedMember.id, medicationName.trim());
      setAlerts(result.alerts);
      setDisclaimer(result.disclaimer);
      setScreen('result');
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function restart() {
    setScreen('home');
    setMedicationName('');
    setPhotoUri(null);
    setAlerts([]);
    setDisclaimer('');
    setErrorMessage('');
  }

  async function askAssistant() {
    if (!selectedMember) {
      setErrorMessage('Select a family member before asking about their records.');
      setScreen('home');
      return;
    }
    if (!assistantQuestion.trim()) {
      setErrorMessage('Ask a question about the selected record.');
      return;
    }

    setAssistantReply('');
    setErrorMessage('');
    setIsAssistantLoading(true);
    try {
      await streamRecordAssistantReply(selectedMember.id, assistantQuestion.trim(), (content) => {
        setAssistantReply((current) => current + content);
      });
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsAssistantLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Family Health LLM</Text>
            <Text style={styles.subtitle}>Your family&apos;s health memory</Text>
          </View>
          <View style={styles.shield}>
            <Text style={styles.shieldText}>SAFE</Text>
          </View>
        </View>

        {screen === 'home' && (
          <Home
            members={members}
            selectedMember={selectedMember}
            newMemberName={newMemberName}
            allergyName={allergyName}
            isLoading={isLoading}
            onNewMemberName={setNewMemberName}
            onAllergyName={setAllergyName}
            onAddMember={() => void addFamilyMember()}
            onSelectMember={setSelectedMember}
            onCamera={() => void choosePrescription('camera')}
            onLibrary={() => void choosePrescription('library')}
            onOpenAssistant={() => {
              if (selectedMember) {
                setScreen('assistant');
              } else {
                setErrorMessage('Select a family member before opening the record assistant.');
              }
            }}
          />
        )}
        {screen === 'review' && (
          <Review
            selectedMember={selectedMember}
            photoUri={photoUri}
            medicationName={medicationName}
            isLoading={isLoading}
            onMedicationName={setMedicationName}
            onReview={() => void reviewSafety()}
            onBack={restart}
          />
        )}
        {screen === 'result' && (
          <Result
            alerts={alerts}
            selectedMember={selectedMember}
            disclaimer={disclaimer}
            onRestart={restart}
          />
        )}
        {screen === 'assistant' && (
          <RecordAssistant
            member={selectedMember}
            question={assistantQuestion}
            reply={assistantReply}
            isLoading={isAssistantLoading}
            onQuestionChange={setAssistantQuestion}
            onAsk={() => void askAssistant()}
            onBack={() => setScreen('home')}
          />
        )}
        {!!errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Home({
  members,
  selectedMember,
  newMemberName,
  allergyName,
  isLoading,
  onNewMemberName,
  onAllergyName,
  onAddMember,
  onSelectMember,
  onCamera,
  onLibrary,
  onOpenAssistant,
}: {
  members: FamilyMember[];
  selectedMember: FamilyMember | null;
  newMemberName: string;
  allergyName: string;
  isLoading: boolean;
  onNewMemberName: (value: string) => void;
  onAllergyName: (value: string) => void;
  onAddMember: () => void;
  onSelectMember: (member: FamilyMember) => void;
  onCamera: () => void;
  onLibrary: () => void;
  onOpenAssistant: () => void;
}) {
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PRESCRIPTION SAFETY CHECK</Text>
        <Text style={styles.heroTitle}>One snap. A clearer next step.</Text>
        <Text style={styles.heroCopy}>
          Keep the important details together and review possible medication risks before a dose.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>WHO IS THIS FOR?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow}>
        {members.map((member) => (
          <Pressable
            key={member.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedMember?.id === member.id }}
            style={[styles.memberChip, selectedMember?.id === member.id && styles.memberChipSelected]}
            onPress={() => onSelectMember(member)}
          >
            <Text style={styles.memberInitial}>{member.display_name[0]?.toUpperCase()}</Text>
            <Text style={styles.memberName} numberOfLines={1}>{member.display_name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.addMemberRow}>
        <TextInput
          value={newMemberName}
          onChangeText={onNewMemberName}
          placeholder="Add family member"
          placeholderTextColor="#738091"
          style={styles.input}
          autoCapitalize="words"
          maxLength={80}
        />
        <Pressable accessibilityRole="button" style={styles.addButton} onPress={onAddMember} disabled={isLoading}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      <TextInput
        value={allergyName}
        onChangeText={onAllergyName}
        placeholder="Allergy to record (optional, e.g. sulfa)"
        placeholderTextColor="#738091"
        style={styles.allergyInput}
        autoCapitalize="words"
        maxLength={160}
      />

      <View style={styles.captureCard}>
        <View style={styles.captureIcon}><Text style={styles.captureIconText}>+</Text></View>
        <Text style={styles.captureTitle}>Add a prescription</Text>
        <Text style={styles.captureCopy}>Photograph the original. You&apos;ll confirm the medication before any safety result.</Text>
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={onCamera}>
          <Text style={styles.primaryButtonText}>Use camera</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onLibrary}>
          <Text style={styles.secondaryButtonText}>Choose from photos</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" style={styles.assistantCard} onPress={onOpenAssistant}>
        <View style={styles.assistantOrb}><Text style={styles.assistantOrbText}>AI</Text></View>
        <View style={styles.assistantCardCopy}>
          <Text style={styles.assistantCardTitle}>Ask your health records</Text>
          <Text style={styles.assistantCardText}>Get a plain-language, real-time explanation.</Text>
        </View>
        <Text style={styles.assistantChevron}>›</Text>
      </Pressable>
      <Text style={styles.privacyNote}>Private by design. Never make a medication decision from this app alone.</Text>
    </>
  );
}

function RecordAssistant({
  member,
  question,
  reply,
  isLoading,
  onQuestionChange,
  onAsk,
  onBack,
}: {
  member: FamilyMember | null;
  question: string;
  reply: string;
  isLoading: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <Text style={styles.sectionLabel}>REAL-TIME RECORD ASSISTANT</Text>
      <View style={styles.assistantHero}>
        <Text style={styles.assistantHeroTitle}>Ask about {member?.display_name}&apos;s record</Text>
        <Text style={styles.assistantHeroCopy}>
          Answers stream from your selected record. It cannot diagnose, prescribe, or confirm medicine safety.
        </Text>
      </View>
      <View style={styles.chatCard}>
        {!!reply && (
          <View style={styles.replyBubble}>
            <Text style={styles.replyLabel}>FAMILY HEALTH LLM AI</Text>
            <Text style={styles.replyText}>{reply}</Text>
          </View>
        )}
        {isLoading && !reply && (
          <View style={styles.thinkingRow}>
            <ActivityIndicator color="#16876A" />
            <Text style={styles.thinkingText}>Reading your selected record...</Text>
          </View>
        )}
        <TextInput
          value={question}
          onChangeText={onQuestionChange}
          placeholder="e.g. What allergy is documented?"
          placeholderTextColor="#738091"
          style={styles.chatInput}
          multiline
          maxLength={600}
          editable={!isLoading}
        />
        <Pressable
          accessibilityRole="button"
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={onAsk}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Ask assistant</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBack} disabled={isLoading}>
          <Text style={styles.assistantBackText}>Back to records</Text>
        </Pressable>
      </View>
      <Text style={styles.privacyNote}>
        The AI uses the selected record context only. Verify all health information with a qualified professional.
      </Text>
    </>
  );
}

function Review({
  selectedMember,
  photoUri,
  medicationName,
  isLoading,
  onMedicationName,
  onReview,
  onBack,
}: {
  selectedMember: FamilyMember | null;
  photoUri: string | null;
  medicationName: string;
  isLoading: boolean;
  onMedicationName: (value: string) => void;
  onReview: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <Text style={styles.sectionLabel}>REVIEW BEFORE CHECKING</Text>
      {photoUri && <Image source={{ uri: photoUri }} style={styles.prescriptionImage} accessibilityLabel="Selected prescription" />}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>Confirm what you see</Text>
        <Text style={styles.reviewCopy}>For {selectedMember?.display_name ?? 'your family member'}, enter the medicine name exactly as it appears.</Text>
        <TextInput
          value={medicationName}
          onChangeText={onMedicationName}
          placeholder="e.g. Bactrim"
          placeholderTextColor="#738091"
          style={styles.medicationInput}
          autoCapitalize="words"
          maxLength={160}
        />
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={onReview} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Check safety</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Start over</Text>
        </Pressable>
      </View>
    </>
  );
}

function Result({
  alerts,
  selectedMember,
  disclaimer,
  onRestart,
}: {
  alerts: SafetyAlert[];
  selectedMember: FamilyMember | null;
  disclaimer: string;
  onRestart: () => void;
}) {
  const mostSevere = alerts[0];
  return (
    <>
      <Text style={styles.sectionLabel}>SAFETY RESULT</Text>
      <View style={[styles.resultCard, mostSevere ? styles.alertCard : styles.clearCard]}>
        <Text style={styles.resultStatus}>{mostSevere ? 'PAUSE AND VERIFY' : 'NO CURATED ALERT FOUND'}</Text>
        <Text style={styles.resultTitle}>{mostSevere?.title ?? 'Still confirm with a professional'}</Text>
        <Text style={styles.resultCopy}>
          {mostSevere?.explanation ?? `No match was found in the MVP safety rules for ${selectedMember?.display_name ?? 'this person'}.`}
        </Text>
        {mostSevere && (
          <View style={styles.actionBox}>
            <Text style={styles.actionLabel}>NEXT STEP</Text>
            <Text style={styles.actionText}>{mostSevere.recommended_action}</Text>
          </View>
        )}
      </View>
      <Text style={styles.disclaimer}>{disclaimer}</Text>
      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={onRestart}>
        <Text style={styles.primaryButtonText}>Check another prescription</Text>
      </Pressable>
    </>
  );
}

function toMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Unable to reach the API. Check your connection and try again.';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  container: {
    padding: 22,
    paddingBottom: 48,
    gap: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  brand: { color: '#132238', fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: '#64748B', fontSize: 13, marginTop: 3 },
  shield: { alignItems: 'center', backgroundColor: '#DDF5EC', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  shieldText: { color: '#18794E', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  hero: { gap: 10, marginTop: 18 },
  eyebrow: { color: '#16876A', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { color: '#132238', fontSize: 34, fontWeight: '800', letterSpacing: -1.2, lineHeight: 39 },
  heroCopy: { color: '#566477', fontSize: 16, lineHeight: 23 },
  sectionLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 8 },
  memberRow: { gap: 10, paddingVertical: 3 },
  memberChip: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E1E8F0', borderRadius: 16, borderWidth: 1, gap: 6, padding: 10, width: 78 },
  memberChipSelected: { backgroundColor: '#EAF9F4', borderColor: '#16876A', borderWidth: 2 },
  memberInitial: { alignItems: 'center', backgroundColor: '#CBECE1', borderRadius: 18, color: '#11634E', fontSize: 15, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 8 },
  memberName: { color: '#25364A', fontSize: 12, fontWeight: '700', maxWidth: 60 },
  addMemberRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E1E8F0', borderRadius: 12, borderWidth: 1, color: '#132238', flex: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  addButton: { alignItems: 'center', backgroundColor: '#E7EEF4', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 17 },
  addButtonText: { color: '#25364A', fontSize: 14, fontWeight: '800' },
  allergyInput: { backgroundColor: '#FFFFFF', borderColor: '#E1E8F0', borderRadius: 12, borderWidth: 1, color: '#132238', fontSize: 14, paddingHorizontal: 14, paddingVertical: 11 },
  captureCard: { alignItems: 'center', backgroundColor: '#133D49', borderRadius: 25, gap: 13, marginTop: 4, padding: 27 },
  captureIcon: { alignItems: 'center', backgroundColor: '#2BC29B', borderRadius: 25, height: 50, justifyContent: 'center', width: 50 },
  captureIconText: { color: '#FFFFFF', fontSize: 30, fontWeight: '300', lineHeight: 34 },
  captureTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  captureCopy: { color: '#CFE3E6', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: '#16876A', borderRadius: 13, justifyContent: 'center', marginTop: 8, minHeight: 51, paddingHorizontal: 20, width: '100%' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButtonText: { color: '#A9E9D6', fontSize: 14, fontWeight: '800', marginTop: 5, padding: 9 },
  assistantCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DDE7EE', borderRadius: 19, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 },
  assistantOrb: { alignItems: 'center', backgroundColor: '#E5F7F1', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  assistantOrbText: { color: '#087A5E', fontSize: 11, fontWeight: '900' },
  assistantCardCopy: { flex: 1, gap: 3 },
  assistantCardTitle: { color: '#1D3045', fontSize: 15, fontWeight: '800' },
  assistantCardText: { color: '#64748B', fontSize: 12 },
  assistantChevron: { color: '#16876A', fontSize: 28, fontWeight: '300' },
  privacyNote: { color: '#708096', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorMessage: { color: '#B42318', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  prescriptionImage: { borderRadius: 22, height: 210, resizeMode: 'cover', width: '100%' },
  reviewCard: { backgroundColor: '#FFFFFF', borderRadius: 23, gap: 12, padding: 21 },
  reviewTitle: { color: '#132238', fontSize: 22, fontWeight: '800' },
  reviewCopy: { color: '#566477', fontSize: 14, lineHeight: 20 },
  medicationInput: { backgroundColor: '#F4F7FA', borderColor: '#D9E1EA', borderRadius: 12, borderWidth: 1, color: '#132238', fontSize: 16, paddingHorizontal: 14, paddingVertical: 14 },
  resultCard: { borderRadius: 24, gap: 13, padding: 23 },
  alertCard: { backgroundColor: '#FFF0EF' },
  clearCard: { backgroundColor: '#EAF9F4' },
  resultStatus: { color: '#BA2A21', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  resultTitle: { color: '#3E2020', fontSize: 25, fontWeight: '800', lineHeight: 31 },
  resultCopy: { color: '#5C3E3A', fontSize: 15, lineHeight: 22 },
  actionBox: { backgroundColor: '#FFFFFF', borderRadius: 14, gap: 6, marginTop: 5, padding: 15 },
  actionLabel: { color: '#8A504B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  actionText: { color: '#3E2020', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  disclaimer: { color: '#64748B', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  assistantHero: { backgroundColor: '#DDF5EC', borderRadius: 22, gap: 8, padding: 20 },
  assistantHeroTitle: { color: '#114836', fontSize: 23, fontWeight: '800', lineHeight: 29 },
  assistantHeroCopy: { color: '#39705E', fontSize: 14, lineHeight: 20 },
  chatCard: { backgroundColor: '#FFFFFF', borderRadius: 23, gap: 14, padding: 19 },
  replyBubble: { backgroundColor: '#EEF8F5', borderRadius: 17, gap: 8, padding: 15 },
  replyLabel: { color: '#16876A', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  replyText: { color: '#264233', fontSize: 15, lineHeight: 22 },
  thinkingRow: { alignItems: 'center', flexDirection: 'row', gap: 10, padding: 10 },
  thinkingText: { color: '#506675', fontSize: 14 },
  chatInput: { backgroundColor: '#F4F7FA', borderColor: '#D9E1EA', borderRadius: 13, borderWidth: 1, color: '#132238', fontSize: 15, lineHeight: 21, minHeight: 93, padding: 14, textAlignVertical: 'top' },
  assistantBackText: { color: '#16876A', fontSize: 14, fontWeight: '800', padding: 9, textAlign: 'center' },
  buttonDisabled: { backgroundColor: '#73B7A5' },
});
