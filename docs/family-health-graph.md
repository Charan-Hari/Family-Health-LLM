# Family health graph

The Neo4j schema is in [`infra/neo4j/schema.cypher`](../infra/neo4j/schema.cypher). The graph stores clinical concepts by coded identifiers rather than free text wherever possible, with a source record ID and temporal attributes on clinical relationships.

## Boundaries

- A `Family` is a tenant boundary; every graph query must start at an authorized `Family` ID.
- `Person` nodes do not expose data across households.
- Family relationship information is sensitive. Capture consent, source, confidence, and revocation state before use.
- Graph patterns may support history visualization; they do not establish genetic risk, causality, or a diagnosis.

## Parameterized Cypher query catalog

**Find consented family members with a condition**

```cypher
MATCH (family:Family {id: $familyId})-[:HAS_MEMBER]->(person:Person)
      -[history:HAS_CONDITION]->(condition:Condition {code_system: $system, code: $code})
RETURN person.id, person.display_name, history.onset_date, history.clinical_status
ORDER BY history.onset_date
```

**List a member's hospital encounters**

```cypher
MATCH (:Family {id: $familyId})-[:HAS_MEMBER]->(person:Person {id: $personId})
      -[:HAD_ENCOUNTER]->(encounter:Encounter)
WHERE encounter.kind = 'hospitalization'
RETURN encounter.id, encounter.occurred_on, encounter.kind
ORDER BY encounter.occurred_on DESC
```

**Show first-degree history candidates for clinician review**

```cypher
MATCH (:Family {id: $familyId})-[:HAS_MEMBER]->(relative:Person)
      -[:PARENT_OF|CHILD_OF*1..1]-(member:Person {id: $personId})
MATCH (relative)-[history:HAS_CONDITION]->(condition:Condition)
RETURN relative.display_name, condition.display, history.onset_date, history.clinical_status
ORDER BY condition.display, history.onset_date
```

Use Neo4j driver parameters (`$familyId`, `$personId`, `$system`, `$code`); never interpolate untrusted values into Cypher.
