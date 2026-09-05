import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
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

type Gender = 'Woman' | 'Man' | 'Prefer not to say';

type Profile = {
  name: string;
  age: string;
  gender: Gender;
  healthIssues: string[];
  allergies: string[];
};

type Finding = {
  severity: 'critical' | 'review' | 'clear';
  title: string;
  detail: string;
  action: string;
};

const DISCLAIMER =
  'Test-session guidance only. This does not diagnose, prescribe, or confirm that a medicine is safe. Ask a qualified clinician or pharmacist.';

export default function App() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('Prefer not to say');
  const [healthIssues, setHealthIssues] = useState('');
  const [allergies, setAllergies] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [medicine, setMedicine] = useState('');
  const [finding, setFinding] = useState<Finding | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  function saveProfile() {
    if (!name.trim()) {
      setMessage('Enter a family member name or test label.');
      return;
    }

    setProfile({
      name: name.trim(),
      age: age.trim(),
      gender,
      healthIssues: splitValues(healthIssues),
      allergies: splitValues(allergies),
    });
    setFinding(null);
    setMessage('');
  }

  function clearSession() {
    setName('');
    setAge('');
    setGender('Prefer not to say');
    setHealthIssues('');
    setAllergies('');
    setProfile(null);
    setMedicine('');
    setFinding(null);
    setPhotoUri(null);
    setMessage('');
  }

  function checkMedicine() {
    if (!profile) {
      setMessage('Create the family profile first.');
      return;
    }
    if (!medicine.trim()) {
      setMessage('Enter a medicine name to check.');
      return;
    }

    setFinding(screenMedicine(medicine, profile));
    setMessage('');
  }

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo access is used only to preview the selected image in this tab.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Family Health LLM</Text>
            <Text style={styles.subtitle}>Simple health-history test workspace</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SESSION ONLY</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Browser test mode</Text>
          <Text style={styles.noticeText}>
            Nothing is uploaded or stored. All details disappear when you refresh or close this tab.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.step}>1. FAMILY MEMBER PROFILE</Text>
          <Text style={styles.title}>Who are you checking for?</Text>

          <Text style={styles.label}>Name or private label</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Test Parent"
            placeholderTextColor="#718096"
            style={styles.input}
            autoCapitalize="words"
            maxLength={80}
          />

          <View style={styles.row}>
            <View style={styles.ageField}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                value={age}
                onChangeText={setAge}
                placeholder="e.g. 62"
                placeholderTextColor="#718096"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View style={styles.genderField}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderRow}>
                {(['Woman', 'Man', 'Prefer not to say'] as Gender[]).map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: gender === option }}
                    onPress={() => setGender(option)}
                    style={[styles.genderButton, gender === option && styles.genderButtonSelected]}
                  >
                    <Text style={[styles.genderText, gender === option && styles.genderTextSelected]}>
                      {option === 'Prefer not to say' ? 'Not say' : option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.label}>Past health issues</Text>
          <TextInput
            value={healthIssues}
            onChangeText={setHealthIssues}
            placeholder="e.g. diabetes, high blood pressure"
            placeholderTextColor="#718096"
            style={[styles.input, styles.multiline]}
            multiline
            maxLength={300}
          />
          <Text style={styles.hint}>Separate entries with commas.</Text>

          <Text style={styles.label}>Allergies or previous reactions</Text>
          <TextInput
            value={allergies}
            onChangeText={setAllergies}
            placeholder="e.g. sulfa, penicillin, ibuprofen"
            placeholderTextColor="#718096"
            style={[styles.input, styles.multiline]}
            multiline
            maxLength={300}
          />
          <Text style={styles.hint}>Only enter synthetic test data in this public preview.</Text>

          <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={saveProfile}>
            <Text style={styles.primaryButtonText}>
              {profile ? 'Update session profile' : 'Create session profile'}
            </Text>
          </Pressable>
        </View>

        {profile && (
          <>
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <View>
                  <Text style={styles.step}>CURRENT SESSION PROFILE</Text>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  <Text style={styles.profileMeta}>
                    {profile.age ? `${profile.age} years` : 'Age not entered'} · {profile.gender}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" onPress={clearSession}>
                  <Text style={styles.clearText}>Clear session</Text>
                </Pressable>
              </View>

              <SummaryRow
                label="Health history"
                value={profile.healthIssues.length ? profile.healthIssues.join(', ') : 'None entered'}
              />
              <SummaryRow
                label="Allergies / reactions"
                value={profile.allergies.length ? profile.allergies.join(', ') : 'None entered'}
                isAlert={profile.allergies.length > 0}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.step}>2. MEDICINE SCREEN</Text>
              <Text style={styles.title}>What should be reviewed?</Text>
              <Text style={styles.bodyText}>
                Enter a medicine name. This browser test uses a small, visible ruleset for allergy matches.
              </Text>

              <Text style={styles.label}>Medicine name</Text>
              <TextInput
                value={medicine}
                onChangeText={setMedicine}
                placeholder="e.g. Bactrim or amoxicillin"
                placeholderTextColor="#718096"
                style={styles.input}
                autoCapitalize="words"
                maxLength={160}
              />

              <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={checkMedicine}>
                <Text style={styles.primaryButtonText}>Check against this history</Text>
              </Pressable>

              <Pressable accessibilityRole="button" style={styles.photoButton} onPress={() => void choosePhoto()}>
                <Text style={styles.photoButtonText}>Optional: preview prescription photo</Text>
              </Pressable>

              {photoUri && (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: photoUri }} style={styles.photo} accessibilityLabel="Local prescription preview" />
                  <Text style={styles.hint}>Preview only. This image is not uploaded or retained.</Text>
                </View>
              )}
            </View>

            {finding && <SafetyResult finding={finding} profile={profile} />}
          </>
        )}

        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Important</Text>
          <Text style={styles.footerText}>{DISCLAIMER}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  isAlert = false,
}: {
  label: string;
  value: string;
  isAlert?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, isAlert && styles.summaryValueAlert]}>{value}</Text>
    </View>
  );
}

function SafetyResult({ finding, profile }: { finding: Finding; profile: Profile }) {
  const style =
    finding.severity === 'critical'
      ? styles.criticalResult
      : finding.severity === 'review'
        ? styles.reviewResult
        : styles.clearResult;

  return (
    <View style={[styles.resultCard, style]}>
      <Text style={styles.resultEyebrow}>
        {finding.severity === 'critical'
          ? 'PAUSE AND VERIFY'
          : finding.severity === 'review'
            ? 'REVIEW WITH A PROFESSIONAL'
            : 'NO LIMITED-RULE MATCH FOUND'}
      </Text>
      <Text style={styles.resultTitle}>{finding.title}</Text>
      <Text style={styles.resultText}>{finding.detail}</Text>

      {profile.healthIssues.length > 0 && (
        <View style={styles.historyBox}>
          <Text style={styles.historyLabel}>SHARE THIS HISTORY</Text>
          <Text style={styles.historyText}>{profile.healthIssues.join(', ')}</Text>
        </View>
      )}

      <View style={styles.actionBox}>
        <Text style={styles.historyLabel}>NEXT STEP</Text>
        <Text style={styles.actionText}>{finding.action}</Text>
      </View>
      <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
    </View>
  );
}

function splitValues(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function screenMedicine(medicineName: string, profile: Profile): Finding {
  const medicine = medicineName.trim().toLowerCase();
  const allergies = profile.allergies.map((allergy) => allergy.toLowerCase());

  const checks = [
    {
      allergyTerms: ['sulfa', 'sulfonamide'],
      medicineTerms: ['bactrim', 'sulfamethoxazole', 'trimethoprim'],
      label: 'sulfa or sulfonamide',
    },
    {
      allergyTerms: ['penicillin'],
      medicineTerms: ['amoxicillin', 'ampicillin', 'penicillin'],
      label: 'penicillin',
    },
    {
      allergyTerms: ['ibuprofen', 'nsaid'],
      medicineTerms: ['ibuprofen', 'naproxen', 'diclofenac'],
      label: 'NSAID',
    },
  ];

  const match = checks.find(
    (check) =>
      allergies.some((allergy) => check.allergyTerms.some((term) => allergy.includes(term))) &&
      check.medicineTerms.some((term) => medicine.includes(term)),
  );

  if (match) {
    return {
      severity: 'critical',
      title: 'Possible allergy-related conflict',
      detail: `This session lists a ${match.label} allergy or reaction, and ${medicineName.trim()} matches this limited browser rule.`,
      action: 'Do not start or change this medicine based on this app. Contact a clinician or pharmacist to review the allergy history.',
    };
  }

  if (profile.allergies.length > 0 || profile.healthIssues.length > 0) {
    return {
      severity: 'review',
      title: 'History should be shared before use',
      detail: `No direct match was found in this small test ruleset for ${medicineName.trim()}. The session still contains health history or allergy entries that a clinician or pharmacist should review.`,
      action: 'Share the listed history with a qualified clinician or pharmacist before making medication decisions.',
    };
  }

  return {
    severity: 'clear',
    title: 'No match in the limited browser rules',
    detail: `This test did not find a match for ${medicineName.trim()}. It does not mean the medicine is safe or appropriate.`,
    action: 'Confirm suitability, dose, and interactions with a qualified clinician or pharmacist.',
  };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { gap: 18, padding: 22, paddingBottom: 44 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  brand: { color: '#132238', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: '#64748B', fontSize: 13, marginTop: 3 },
  badge: { backgroundColor: '#FFF0CF', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  badgeText: { color: '#875B00', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  notice: { backgroundColor: '#FFF7E7', borderColor: '#F0C775', borderRadius: 16, borderWidth: 1, gap: 4, padding: 15 },
  noticeTitle: { color: '#7A5500', fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  noticeText: { color: '#755C27', fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, gap: 10, padding: 20 },
  step: { color: '#16876A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#162B42', fontSize: 23, fontWeight: '800', lineHeight: 29 },
  bodyText: { color: '#566477', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  label: { color: '#34485D', fontSize: 13, fontWeight: '800', marginTop: 5 },
  input: { backgroundColor: '#F5F7FA', borderColor: '#DDE5ED', borderRadius: 12, borderWidth: 1, color: '#132238', fontSize: 15, minHeight: 49, paddingHorizontal: 13, paddingVertical: 12 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  hint: { color: '#718096', fontSize: 11, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 12 },
  ageField: { flex: 0.28 },
  genderField: { flex: 0.72 },
  genderRow: { flexDirection: 'row', gap: 5 },
  genderButton: { alignItems: 'center', backgroundColor: '#F5F7FA', borderColor: '#DDE5ED', borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 49, justifyContent: 'center', paddingHorizontal: 4 },
  genderButtonSelected: { backgroundColor: '#E3F5EF', borderColor: '#16876A' },
  genderText: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  genderTextSelected: { color: '#10664F' },
  primaryButton: { alignItems: 'center', backgroundColor: '#16876A', borderRadius: 13, justifyContent: 'center', marginTop: 8, minHeight: 51, paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  profileCard: { backgroundColor: '#EAF8F3', borderRadius: 22, gap: 12, padding: 20 },
  profileHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  profileName: { color: '#133D49', fontSize: 22, fontWeight: '800', marginTop: 5 },
  profileMeta: { color: '#526C68', fontSize: 13, marginTop: 3 },
  clearText: { color: '#A43128', fontSize: 12, fontWeight: '800', padding: 4 },
  summaryRow: { gap: 3 },
  summaryLabel: { color: '#52716A', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  summaryValue: { color: '#24473D', fontSize: 14, lineHeight: 20 },
  summaryValueAlert: { color: '#9E3028', fontWeight: '700' },
  photoButton: { alignItems: 'center', minHeight: 42, justifyContent: 'center' },
  photoButtonText: { color: '#16876A', fontSize: 13, fontWeight: '800' },
  photoWrap: { gap: 7, marginTop: 4 },
  photo: { borderRadius: 14, height: 180, resizeMode: 'cover', width: '100%' },
  resultCard: { borderRadius: 22, gap: 12, padding: 21 },
  criticalResult: { backgroundColor: '#FFF0EF' },
  reviewResult: { backgroundColor: '#FFF7E7' },
  clearResult: { backgroundColor: '#EAF8F3' },
  resultEyebrow: { color: '#A1382E', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  resultTitle: { color: '#3C2929', fontSize: 23, fontWeight: '800', lineHeight: 29 },
  resultText: { color: '#62433E', fontSize: 14, lineHeight: 21 },
  historyBox: { backgroundColor: '#FFFFFF', borderRadius: 13, gap: 5, padding: 14 },
  historyLabel: { color: '#7A5C52', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  historyText: { color: '#3D312D', fontSize: 14, lineHeight: 20 },
  actionBox: { backgroundColor: '#FFFFFF', borderRadius: 13, gap: 5, padding: 14 },
  actionText: { color: '#3D312D', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  disclaimer: { color: '#6B7280', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  message: { color: '#A43128', fontSize: 13, fontWeight: '700', lineHeight: 19, textAlign: 'center' },
  footer: { backgroundColor: '#EAF0F5', borderRadius: 16, gap: 5, padding: 16 },
  footerTitle: { color: '#3D5366', fontSize: 12, fontWeight: '900' },
  footerText: { color: '#53687B', fontSize: 12, lineHeight: 18 },
});
