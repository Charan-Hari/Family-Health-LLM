import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Gender = 'Woman' | 'Man' | 'Prefer not to say';
type Level = 'urgent' | 'review' | 'info';

type TimelineItem = {
  id: string;
  date: string;
  note: string;
};

type Profile = {
  id: string;
  name: string;
  age: string;
  gender: Gender;
  conditions: string[];
  allergies: string[];
  medicines: string[];
  timeline: TimelineItem[];
};

type Finding = {
  level: Level;
  title: string;
  detail: string;
  action: string;
};

const disclaimer =
  'This is an advisory health workspace, not medical advice. Do not start, stop, or change a medicine without a qualified clinician or pharmacist.';

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('Prefer not to say');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicines, setMedicines] = useState('');
  const [medicineToReview, setMedicineToReview] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [message, setMessage] = useState('');

  const selected = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  function resetForm() {
    setName('');
    setAge('');
    setGender('Prefer not to say');
    setConditions('');
    setAllergies('');
    setMedicines('');
    setMedicineToReview('');
    setEventDate('');
    setEventNote('');
    setFindings([]);
    setMessage('');
  }

  function addNewMember() {
    setSelectedId(null);
    resetForm();
  }

  function selectMember(profile: Profile) {
    setSelectedId(profile.id);
    setName(profile.name);
    setAge(profile.age);
    setGender(profile.gender);
    setConditions(profile.conditions.join(', '));
    setAllergies(profile.allergies.join(', '));
    setMedicines(profile.medicines.join(', '));
    setMedicineToReview('');
    setFindings([]);
    setMessage('');
  }

  function saveProfile() {
    if (!name.trim()) {
      setMessage('Enter a family member name before continuing.');
      return;
    }

    const profile: Profile = {
      id: selected?.id ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      age: age.trim(),
      gender,
      conditions: splitList(conditions),
      allergies: splitList(allergies),
      medicines: splitList(medicines),
      timeline: selected?.timeline ?? [],
    };

    setProfiles((current) =>
      current.some((item) => item.id === profile.id)
        ? current.map((item) => (item.id === profile.id ? profile : item))
        : [profile, ...current],
    );
    setSelectedId(profile.id);
    setFindings([]);
    setMessage('Profile is ready in this private browser session.');
  }

  function reviewMedicine() {
    if (!selected) {
      setMessage('Create or select a family member profile first.');
      return;
    }
    if (!medicineToReview.trim()) {
      setMessage('Enter a medicine name to review.');
      return;
    }
    setFindings(createFindings(medicineToReview, selected));
    setMessage('');
  }

  function addTimelineItem() {
    if (!selected) {
      setMessage('Save the profile before adding timeline details.');
      return;
    }
    if (!eventNote.trim()) {
      setMessage('Enter an event or health note.');
      return;
    }

    const nextProfile: Profile = {
      ...selected,
      timeline: [
        {
          id: `event-${Date.now()}`,
          date: eventDate.trim() || 'Date not entered',
          note: eventNote.trim(),
        },
        ...selected.timeline,
      ],
    };

    setProfiles((current) => current.map((item) => (item.id === nextProfile.id ? nextProfile : item)));
    setEventDate('');
    setEventNote('');
    setMessage('Timeline detail added for this session.');
  }

  function clearSession() {
    setProfiles([]);
    setSelectedId(null);
    resetForm();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Family Health LLM</Text>
            <Text style={styles.subtitle}>Your family health workspace</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PRIVATE SESSION</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Your details stay in this browser tab</Text>
          <Text style={styles.noticeText}>
            Nothing is uploaded or saved. All information is cleared when you refresh or close this page.
          </Text>
        </View>

        {profiles.length > 0 && (
          <View style={styles.memberSection}>
            <View style={styles.sectionTop}>
              <Text style={styles.section}>FAMILY MEMBERS</Text>
              <Pressable onPress={addNewMember}>
                <Text style={styles.link}>Add another</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow}>
              {profiles.map((profile) => (
                <Pressable
                  key={profile.id}
                  onPress={() => selectMember(profile)}
                  style={[styles.member, selectedId === profile.id && styles.memberSelected]}
                >
                  <Text style={styles.initial}>{profile.name[0]?.toUpperCase()}</Text>
                  <Text numberOfLines={1} style={styles.memberName}>{profile.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.section}>1. FAMILY MEMBER PROFILE</Text>
          <Text style={styles.title}>{selected ? `Update ${selected.name}` : 'Add a family member'}</Text>

          <Field label="Name or private label">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Parent or Test User"
              placeholderTextColor="#718096"
              style={styles.input}
              autoCapitalize="words"
            />
          </Field>

          <View style={styles.row}>
            <View style={styles.ageColumn}>
              <Field label="Age">
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  placeholder="62"
                  placeholderTextColor="#718096"
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </Field>
            </View>

            <View style={styles.genderColumn}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderRow}>
                {(['Woman', 'Man', 'Prefer not to say'] as Gender[]).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setGender(option)}
                    style={[styles.genderButton, gender === option && styles.genderSelected]}
                  >
                    <Text style={[styles.genderText, gender === option && styles.genderTextSelected]}>
                      {option === 'Prefer not to say' ? 'Not say' : option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <Field label="Past health issues">
            <TextInput
              value={conditions}
              onChangeText={setConditions}
              placeholder="e.g. diabetes, high blood pressure, kidney disease"
              placeholderTextColor="#718096"
              style={[styles.input, styles.multi]}
              multiline
            />
          </Field>

          <Field label="Allergies or previous reactions">
            <TextInput
              value={allergies}
              onChangeText={setAllergies}
              placeholder="e.g. sulfa, penicillin, ibuprofen"
              placeholderTextColor="#718096"
              style={[styles.input, styles.multi]}
              multiline
            />
          </Field>

          <Field label="Current medicines">
            <TextInput
              value={medicines}
              onChangeText={setMedicines}
              placeholder="e.g. warfarin, telmisartan"
              placeholderTextColor="#718096"
              style={[styles.input, styles.multi]}
              multiline
            />
          </Field>

          <Text style={styles.hint}>Separate multiple entries with commas.</Text>
          <Pressable style={styles.primary} onPress={saveProfile}>
            <Text style={styles.primaryText}>{selected ? 'Save profile changes' : 'Create family profile'}</Text>
          </Pressable>
        </View>

        {selected && (
          <>
            <View style={styles.snapshot}>
              <View style={styles.sectionTop}>
                <View>
                  <Text style={styles.section}>CURRENT HEALTH SNAPSHOT</Text>
                  <Text style={styles.profileName}>{selected.name}</Text>
                  <Text style={styles.profileMeta}>
                    {selected.age ? `${selected.age} years` : 'Age not entered'} · {selected.gender}
                  </Text>
                </View>
                <Pressable onPress={clearSession}>
                  <Text style={styles.clear}>Clear session</Text>
                </Pressable>
              </View>
              <Snapshot label="Health history" values={selected.conditions} />
              <Snapshot label="Allergies / reactions" values={selected.allergies} alert />
              <Snapshot label="Current medicines" values={selected.medicines} />
            </View>

            <View style={styles.card}>
              <Text style={styles.section}>2. MEDICINE REVIEW</Text>
              <Text style={styles.title}>What should be reviewed?</Text>
              <Text style={styles.body}>
                Compare a medicine with the allergy, health-history, and current-medicine details above.
              </Text>
              <Field label="Medicine name">
                <TextInput
                  value={medicineToReview}
                  onChangeText={setMedicineToReview}
                  placeholder="e.g. Bactrim, amoxicillin, ibuprofen"
                  placeholderTextColor="#718096"
                  style={styles.input}
                  autoCapitalize="words"
                />
              </Field>
              <Pressable style={styles.primary} onPress={reviewMedicine}>
                <Text style={styles.primaryText}>Review against this history</Text>
              </Pressable>
            </View>

            {findings.length > 0 && (
              <View style={styles.findings}>
                <Text style={styles.section}>WHAT TO REVIEW OR AVOID</Text>
                {findings.map((finding, index) => (
                  <FindingCard key={`${finding.title}-${index}`} finding={finding} />
                ))}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.section}>3. HEALTH TIMELINE</Text>
              <Text style={styles.title}>Keep important context together</Text>

              <Field label="Date (optional)">
                <TextInput
                  value={eventDate}
                  onChangeText={setEventDate}
                  placeholder="e.g. March 2025"
                  placeholderTextColor="#718096"
                  style={styles.input}
                />
              </Field>

              <Field label="Health event or note">
                <TextInput
                  value={eventNote}
                  onChangeText={setEventNote}
                  placeholder="e.g. Started blood pressure medication"
                  placeholderTextColor="#718096"
                  style={[styles.input, styles.multi]}
                  multiline
                />
              </Field>

              <Pressable style={styles.outline} onPress={addTimelineItem}>
                <Text style={styles.outlineText}>Add timeline detail</Text>
              </Pressable>

              {selected.timeline.map((item) => (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.dot} />
                  <View style={styles.timelineText}>
                    <Text style={styles.timelineDate}>{item.date}</Text>
                    <Text style={styles.timelineNote}>{item.note}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.brief}>
              <Text style={styles.section}>DOCTOR VISIT BRIEF</Text>
              <Text style={styles.title}>Key details to share</Text>
              <Text style={styles.briefText}>Conditions: {selected.conditions.join(', ') || 'None entered'}</Text>
              <Text style={styles.briefText}>Allergies: {selected.allergies.join(', ') || 'None entered'}</Text>
              <Text style={styles.briefText}>Current medicines: {selected.medicines.join(', ') || 'None entered'}</Text>
              <Text style={styles.hint}>This brief is available only in the current browser session.</Text>
            </View>
          </>
        )}

        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Important</Text>
          <Text style={styles.footerText}>{disclaimer}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Snapshot({ label, values, alert = false }: { label: string; values: string[]; alert?: boolean }) {
  return (
    <View style={styles.snapshotItem}>
      <Text style={styles.snapshotLabel}>{label}</Text>
      <Text style={[styles.snapshotValue, alert && values.length > 0 && styles.snapshotAlert]}>
        {values.join(', ') || 'None entered'}
      </Text>
    </View>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const background =
    finding.level === 'urgent' ? styles.urgent :
    finding.level === 'review' ? styles.review :
    styles.info;

  return (
    <View style={[styles.finding, background]}>
      <Text style={styles.findingLevel}>
        {finding.level === 'urgent' ? 'PAUSE AND VERIFY' : finding.level === 'review' ? 'REVIEW WITH A PROFESSIONAL' : 'INFORMATION'}
      </Text>
      <Text style={styles.findingTitle}>{finding.title}</Text>
      <Text style={styles.findingText}>{finding.detail}</Text>
      <View style={styles.action}>
        <Text style={styles.actionLabel}>NEXT STEP</Text>
        <Text style={styles.actionText}>{finding.action}</Text>
      </View>
    </View>
  );
}

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function createFindings(medicineName: string, profile: Profile): Finding[] {
  const medicine = medicineName.toLowerCase().trim();
  const allergies = profile.allergies.map((item) => item.toLowerCase());
  const conditions = profile.conditions.map((item) => item.toLowerCase());
  const activeMedicines = profile.medicines.map((item) => item.toLowerCase());
  const results: Finding[] = [];

  const allergyRules = [
    { allergies: ['sulfa', 'sulfonamide'], medicines: ['bactrim', 'sulfamethoxazole', 'trimethoprim'], label: 'sulfa or sulfonamide' },
    { allergies: ['penicillin'], medicines: ['amoxicillin', 'ampicillin', 'penicillin'], label: 'penicillin' },
    { allergies: ['ibuprofen', 'nsaid'], medicines: ['ibuprofen', 'naproxen', 'diclofenac'], label: 'NSAID' },
  ];

  allergyRules.forEach((rule) => {
    const allergyMatch = allergies.some((entry) => rule.allergies.some((term) => entry.includes(term)));
    const medicineMatch = rule.medicines.some((term) => medicine.includes(term));
    if (allergyMatch && medicineMatch) {
      results.push({
        level: 'urgent',
        title: 'Possible allergy-related conflict',
        detail: `The entered history includes a ${rule.label} allergy or reaction, and ${medicineName} matches this limited screening rule.`,
        action: 'Do not make a medication decision from this result. Ask a clinician or pharmacist to review the allergy history.',
      });
    }
  });

  const nsaid = ['ibuprofen', 'naproxen', 'diclofenac'].some((term) => medicine.includes(term));
  if (nsaid && conditions.some((item) => item.includes('kidney'))) {
    results.push({
      level: 'review',
      title: 'Kidney history should be reviewed',
      detail: 'The entered health history mentions kidney disease and this medicine matches an NSAID screening category.',
      action: 'Ask a clinician or pharmacist whether this medicine is appropriate.',
    });
  }

  if (nsaid && activeMedicines.some((item) => item.includes('warfarin') || item.includes('blood thinner'))) {
    results.push({
      level: 'review',
      title: 'Current medicine combination needs review',
      detail: 'The current medicine list includes warfarin or a blood thinner and this medicine matches an NSAID screening category.',
      action: 'Contact a clinician or pharmacist before combining these medicines.',
    });
  }

  if (results.length === 0) {
    results.push({
      level: 'info',
      title: 'No match in the limited session rules',
      detail: `No direct rule matched ${medicineName}. This does not confirm the medicine is safe, suitable, or correctly dosed.`,
      action: 'Confirm suitability, interactions, and dose with a qualified clinician or pharmacist.',
    });
  }

  return results;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8FB' },
  page: { gap: 18, padding: 22, paddingBottom: 44 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  brand: { color: '#132238', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 13, marginTop: 3 },
  badge: { backgroundColor: '#E2F5EE', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  badgeText: { color: '#167658', fontSize: 10, fontWeight: '900' },
  notice: { backgroundColor: '#FFF7E7', borderColor: '#F0C775', borderRadius: 16, borderWidth: 1, gap: 4, padding: 15 },
  noticeTitle: { color: '#795500', fontSize: 12, fontWeight: '900' },
  noticeText: { color: '#755C27', fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, gap: 10, padding: 20 },
  section: { color: '#16876A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#162B42', fontSize: 23, fontWeight: '800', lineHeight: 29 },
  body: { color: '#566477', fontSize: 14, lineHeight: 20 },
  field: { gap: 6, marginTop: 4 },
  label: { color: '#34485D', fontSize: 13, fontWeight: '800' },
  input: { backgroundColor: '#F5F7FA', borderColor: '#DDE5ED', borderRadius: 12, borderWidth: 1, color: '#132238', fontSize: 15, minHeight: 49, paddingHorizontal: 13, paddingVertical: 12 },
  multi: { minHeight: 70, textAlignVertical: 'top' },
  hint: { color: '#718096', fontSize: 11, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 12 },
  ageColumn: { flex: 0.28 },
  genderColumn: { flex: 0.72, gap: 6, marginTop: 4 },
  genderRow: { flexDirection: 'row', gap: 5 },
  genderButton: { alignItems: 'center', backgroundColor: '#F5F7FA', borderColor: '#DDE5ED', borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 49, justifyContent: 'center' },
  genderSelected: { backgroundColor: '#E2F5EE', borderColor: '#16876A' },
  genderText: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  genderTextSelected: { color: '#126B52' },
  primary: { alignItems: 'center', backgroundColor: '#16876A', borderRadius: 13, justifyContent: 'center', marginTop: 8, minHeight: 51 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  memberSection: { gap: 9 },
  sectionTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: '#16876A', fontSize: 13, fontWeight: '800' },
  memberRow: { gap: 9 },
  member: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DDE5ED', borderRadius: 15, borderWidth: 1, gap: 5, padding: 9, width: 82 },
  memberSelected: { backgroundColor: '#E8F7F1', borderColor: '#16876A', borderWidth: 2 },
  initial: { backgroundColor: '#CDEEE3', borderRadius: 16, color: '#126B52', fontSize: 14, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 7 },
  memberName: { color: '#263B50', fontSize: 11, fontWeight: '800', maxWidth: 60 },
  snapshot: { backgroundColor: '#EAF8F3', borderRadius: 22, gap: 12, padding: 20 },
  profileName: { color: '#133D49', fontSize: 22, fontWeight: '800', marginTop: 5 },
  profileMeta: { color: '#526C68', fontSize: 13, marginTop: 3 },
  clear: { color: '#A43128', fontSize: 12, fontWeight: '800', padding: 4 },
  snapshotItem: { gap: 3 },
  snapshotLabel: { color: '#52716A', fontSize: 10, fontWeight: '900' },
  snapshotValue: { color: '#24473D', fontSize: 14, lineHeight: 20 },
  snapshotAlert: { color: '#9E3028', fontWeight: '700' },
  findings: { gap: 10 },
  finding: { borderRadius: 20, gap: 10, padding: 19 },
  urgent: { backgroundColor: '#FFF0EF' },
  review: { backgroundColor: '#FFF7E7' },
  info: { backgroundColor: '#EAF8F3' },
  findingLevel: { color: '#A1382E', fontSize: 10, fontWeight: '900' },
  findingTitle: { color: '#3C2929', fontSize: 21, fontWeight: '800', lineHeight: 27 },
  findingText: { color: '#62433E', fontSize: 14, lineHeight: 21 },
  action: { backgroundColor: '#FFFFFF', borderRadius: 13, gap: 5, padding: 14 },
  actionLabel: { color: '#7A5C52', fontSize: 10, fontWeight: '900' },
  actionText: { color: '#3D312D', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  outline: { alignItems: 'center', borderColor: '#16876A', borderRadius: 13, borderWidth: 1, justifyContent: 'center', marginTop: 8, minHeight: 48 },
  outlineText: { color: '#16876A', fontSize: 14, fontWeight: '800' },
  timelineItem: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dot: { backgroundColor: '#16876A', borderRadius: 5, height: 10, marginTop: 5, width: 10 },
  timelineText: { flex: 1, gap: 2 },
  timelineDate: { color: '#16876A', fontSize: 11, fontWeight: '900' },
  timelineNote: { color: '#30475C', fontSize: 14, lineHeight: 20 },
  brief: { backgroundColor: '#EAF0F5', borderRadius: 22, gap: 8, padding: 20 },
  briefText: { color: '#3D5366', fontSize: 14, lineHeight: 20 },
  message: { color: '#A43128', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  footer: { backgroundColor: '#133D49', borderRadius: 18, gap: 5, padding: 17 },
  footerTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  footerText: { color: '#D0E2E5', fontSize: 12, lineHeight: 18 },
});
