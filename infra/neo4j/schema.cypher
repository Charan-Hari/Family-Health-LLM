// Execute with a Neo4j account permitted to create constraints and indexes.
// All relationship creation must be authorized in the application before use.
CREATE CONSTRAINT family_id IF NOT EXISTS FOR (f:Family) REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT condition_id IF NOT EXISTS FOR (c:Condition) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT medication_id IF NOT EXISTS FOR (m:Medication) REQUIRE m.id IS UNIQUE;
CREATE CONSTRAINT allergy_id IF NOT EXISTS FOR (a:Allergy) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT encounter_id IF NOT EXISTS FOR (e:Encounter) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT observation_id IF NOT EXISTS FOR (o:Observation) REQUIRE o.id IS UNIQUE;
CREATE INDEX condition_code IF NOT EXISTS FOR (c:Condition) ON (c.code_system, c.code);
CREATE INDEX medication_code IF NOT EXISTS FOR (m:Medication) ON (m.code_system, m.code);
CREATE INDEX observation_code IF NOT EXISTS FOR (o:Observation) ON (o.code_system, o.code);

// Node labels:
// Family(id), Person(id, display_name, birth_date), Condition(id, code_system, code, display),
// Medication(id, code_system, code, display), Allergy(id, substance, reaction),
// Encounter(id, occurred_on, kind), Observation(id, code_system, code, value, unit, observed_on).
//
// Relationships:
// (Family)-[:HAS_MEMBER]->(Person)
// (Person)-[:PARENT_OF]->(Person)
// (Person)-[:HAS_CONDITION {onset_date, clinical_status, source_record_id}]->(Condition)
// (Person)-[:TAKES {status, dose, frequency, start_date, end_date, source_record_id}]->(Medication)
// (Person)-[:HAS_ALLERGY {recorded_on, source_record_id}]->(Allergy)
// (Person)-[:HAD_ENCOUNTER]->(Encounter)
// (Encounter)-[:RECORDED_OBSERVATION]->(Observation)
