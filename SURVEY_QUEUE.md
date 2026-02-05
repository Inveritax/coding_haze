# Survey Queue System

## Database Tables

### `survey_batches`

Groups of queue items created together (one "Generate" action = one batch).

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Batch ID |
| `survey_config_id` | INTEGER FK | References `survey_configs.id` |
| `name` | VARCHAR(255) | Batch name (e.g., "Q1 2026 Treasurer Survey") |
| `scope_type` | VARCHAR(50) | Always `"state"` currently |
| `scope_filter` | JSONB | Filter settings (see below) |
| `total_items` | INTEGER | Count of queue items in this batch |
| `created_by` | VARCHAR(255) | Username who generated the batch |
| `created_at` | TIMESTAMP | When the batch was created |

**`scope_filter` JSONB structure:**

```json
{
  "name": "Q1 2026 Treasurer Survey",
  "states": ["IL", "WI"],
  "jurisdictionType": "county_only"
}
```

- `jurisdictionType: "county_only"` — only county-level rows (`municipality_name IS NULL`)
- `jurisdictionType: "all"` — every record (counties + municipalities)

---

### `survey_queue`

One row per jurisdiction per batch. Each row gets a unique UUID for its public survey link.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Queue item ID |
| `unique_id` | UUID | Public-facing survey link ID (auto-generated) |
| `batch_id` | INTEGER FK | References `survey_batches.id` (CASCADE delete) |
| `county_id` | INTEGER FK | References `counties.id` |
| `survey_config_id` | INTEGER FK | References `survey_configs.id` |
| `status` | VARCHAR(20) | `pending`, `sent`, `completed`, `failed`, `cancelled` |
| `error_message` | TEXT | Error details if status = `failed` |
| `sent_at` | TIMESTAMP | When survey was sent/dispatched |
| `completed_at` | TIMESTAMP | When survey response was submitted |
| `response_data` | JSONB | Survey response key-value pairs (see below) |
| `created_at` | TIMESTAMP | Row creation time |
| `updated_at` | TIMESTAMP | Last update time |

**Unique constraint:** `(batch_id, county_id)` — prevents duplicate jurisdictions in the same batch.

**Status lifecycle:**
```
pending → sent → completed
pending → sent → failed
pending → cancelled
```

---

## What's Stored in `response_data`

When a survey is completed, `response_data` contains a JSONB object with field keys mapped to response values. For `db_field` type items, the key is the `dbField` name. For `due_date_group` items, individual dates are stored as `due_date_1`, `due_date_2`, etc.

**Example response_data:**

```json
{
  "primary_contact_name": "Jane Smith",
  "primary_contact_phone": "555-123-4567",
  "primary_contact_email": "jane@alsip.gov",
  "current_tax_year": "2025",
  "due_date_1": "2025-03-01",
  "due_date_2": "2025-06-01",
  "tax_billing_date": "2025-01-15",
  "delq_search_start_date": "2025-09-01",
  "default_escrow_search_start_date": "2025-04-01",
  "tax_authority_physical_address": "123 Main St, Alsip, IL 60803",
  "general_phone_number": "555-999-0000",
  "web_address": "https://alsip.gov",
  "tax_authority_mailing_address": "PO Box 123, Alsip, IL 60803"
}
```

The keys come directly from the survey config's `dbField` property on each `db_field` item. These match column names in the `research_results` table.

---

## API Endpoints

### Authenticated (require JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/survey-queue/batches` | List all batches with per-status counts |
| GET | `/api/survey-queue/batches/:batchId` | Get single batch details |
| GET | `/api/survey-queue/items` | Paginated queue items (see query params below) |
| GET | `/api/survey-queue/stats` | Aggregate counts by status |
| POST | `/api/survey-queue/preview` | Preview count for a given scope |
| POST | `/api/survey-queue/generate` | Create batch + queue items |
| PATCH | `/api/survey-queue/items/:itemId` | Update single item status |
| POST | `/api/survey-queue/batches/:batchId/bulk-action` | Bulk retry/cancel |
| DELETE | `/api/survey-queue/batches/:batchId` | Delete batch (cascades to items) |

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/survey/:uniqueId` | Fetch survey form config + municipality info |
| POST | `/api/survey/:uniqueId/submit` | Submit survey response |

---

### Query Parameters for `GET /api/survey-queue/items`

| Param | Type | Description |
|-------|------|-------------|
| `batchId` | number | Filter by batch |
| `status` | string | Filter by status: `pending`, `sent`, `completed`, `failed`, `cancelled` |
| `state` | string | Filter by state (e.g., `IL`) |
| `surveyConfigId` | number | Filter by survey config |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |

**Response shape:**

```json
{
  "items": [
    {
      "id": 1,
      "unique_id": "2775d4c0-f862-4903-9eb9-181f0091e41a",
      "batch_id": 1,
      "county_id": 4057,
      "survey_config_id": 1,
      "status": "completed",
      "error_message": null,
      "sent_at": null,
      "completed_at": "2026-01-26T17:34:34.706Z",
      "response_data": { "primary_contact_name": "Jane Smith", "..." : "..." },
      "created_at": "2026-01-26T17:28:33.000Z",
      "updated_at": "2026-01-26T17:34:34.706Z",
      "state": "IL",
      "county_name": "Cook County",
      "municipality_name": "Alsip village",
      "survey_name": "Treasurer Information Survey"
    }
  ],
  "total": 151,
  "page": 1,
  "totalPages": 4
}
```

---

### `GET /api/survey-queue/stats`

Returns aggregate counts. Optionally filter by `?batchId=`.

```json
{
  "stats": {
    "total": "151",
    "pending": "150",
    "sent": "0",
    "completed": "1",
    "failed": "0",
    "cancelled": "0"
  }
}
```

---

### `POST /api/survey-queue/preview`

Preview how many jurisdictions match a scope before generating.

**Request:**
```json
{
  "scopeType": "state",
  "scopeFilter": {
    "states": ["IL"],
    "jurisdictionType": "county_only"
  }
}
```

**Response:**
```json
{
  "count": 103
}
```

---

### `POST /api/survey-queue/generate`

Generate a batch with queue items.

**Request:**
```json
{
  "surveyConfigId": 1,
  "scopeType": "state",
  "scopeFilter": {
    "name": "IL County Treasurers Q1 2026",
    "states": ["IL"],
    "jurisdictionType": "county_only"
  }
}
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "id": 2,
    "survey_config_id": 1,
    "name": "IL County Treasurers Q1 2026",
    "scope_type": "state",
    "scope_filter": { "..." : "..." },
    "total_items": 103,
    "created_by": "admin",
    "created_at": "2026-01-26T18:00:00.000Z"
  }
}
```

---

### `GET /api/survey/:uniqueId` (Public)

Returns the survey form config with template variables substituted.

**Response (pending/sent):**
```json
{
  "success": true,
  "completed": false,
  "uniqueId": "2775d4c0-f862-4903-9eb9-181f0091e41a",
  "surveyName": "Treasurer Information Survey",
  "municipality": "Alsip village",
  "state": "IL",
  "county": "Cook County",
  "config": {
    "meta": {
      "title": "Treasurer Information Survey",
      "introduction": "Please complete the following fields.",
      "thankYouMessage": "Thank you for completing this survey."
    },
    "items": [
      {
        "type": "section_header",
        "content": "Treasurer Information"
      },
      {
        "type": "db_field",
        "label": "Contact Name",
        "dbField": "primary_contact_name",
        "inputType": "text",
        "required": false
      },
      {
        "type": "due_date_group",
        "label": "Due Dates",
        "maxDates": 10,
        "helpText": "Fill in a date to reveal the next one."
      }
    ]
  }
}
```

**Response (already completed):**
```json
{
  "success": true,
  "completed": true,
  "completedAt": "2026-01-26T17:34:34.706Z",
  "surveyName": "Treasurer Information Survey",
  "municipality": "Alsip village",
  "state": "IL",
  "county": "Cook County"
}
```

---

### `POST /api/survey/:uniqueId/submit` (Public)

Submit survey responses. Returns 409 if already completed, 410 if cancelled.

**Request:**
```json
{
  "responses": {
    "primary_contact_name": "Jane Smith",
    "primary_contact_phone": "555-123-4567",
    "due_date_1": "2025-03-01",
    "due_date_2": "2025-06-01"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Survey submitted successfully"
}
```

---

## SQL Examples

### Count by status for a batch
```sql
SELECT status, COUNT(*)
FROM survey_queue
WHERE batch_id = 1
GROUP BY status;
```

### Get completed responses with county info
```sql
SELECT
  sq.unique_id,
  sq.completed_at,
  sq.response_data,
  c.state,
  c.county_name,
  c.municipality_name
FROM survey_queue sq
JOIN counties c ON c.id = sq.county_id
WHERE sq.status = 'completed'
  AND sq.batch_id = 1
ORDER BY sq.completed_at DESC;
```

### Get all pending items for a state
```sql
SELECT sq.*, c.state, c.county_name, c.municipality_name
FROM survey_queue sq
JOIN counties c ON c.id = sq.county_id
WHERE sq.status = 'pending'
  AND c.state = 'IL'
ORDER BY c.county_name, c.municipality_name;
```

### Extract specific response fields
```sql
SELECT
  c.county_name,
  c.municipality_name,
  sq.response_data->>'primary_contact_name' as contact_name,
  sq.response_data->>'primary_contact_email' as contact_email,
  sq.response_data->>'current_tax_year' as tax_year,
  sq.response_data->>'due_date_1' as due_date_1,
  sq.response_data->>'due_date_2' as due_date_2
FROM survey_queue sq
JOIN counties c ON c.id = sq.county_id
WHERE sq.status = 'completed'
ORDER BY c.state, c.county_name;
```

### Batch summary with completion rate
```sql
SELECT
  sb.id,
  sb.name,
  sb.total_items,
  COUNT(*) FILTER (WHERE sq.status = 'completed') as completed,
  COUNT(*) FILTER (WHERE sq.status = 'pending') as pending,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE sq.status = 'completed') / NULLIF(sb.total_items, 0), 1
  ) as completion_pct
FROM survey_batches sb
LEFT JOIN survey_queue sq ON sq.batch_id = sb.id
GROUP BY sb.id, sb.name, sb.total_items
ORDER BY sb.created_at DESC;
```

### Public survey link format
```
http://localhost:5173/survey/{unique_id}
```
Example: `http://localhost:5173/survey/2775d4c0-f862-4903-9eb9-181f0091e41a`
