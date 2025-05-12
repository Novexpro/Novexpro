# LME Cash Settlement API Documentation

This document provides comprehensive information about the consolidated LME Cash Settlement API, which handles LME West Metal Price data, RBI Rate data, and calculates the LME Cash Settlement values.

## API Endpoints

All functionality is now handled by a single API file: `/api/lmecashcal.ts`. The specific functionality is controlled through HTTP methods and query parameters.

### Get LME Cash Settlement Data

Retrieves all LME Cash Settlement records.

```
GET /api/lmecashcal
```

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "date": "2023-05-30T00:00:00.000Z",
      "price": 2500,
      "Dollar_Difference": 25.5,
      "INR_Difference": 2150.25,
      "createdAt": "2023-05-30T12:00:00.000Z",
      "updatedAt": "2023-05-30T12:00:00.000Z"
    },
    // more records...
  ]
}
```

### Calculate LME Cash Settlement

Manually triggers the calculation and storage of LME Cash Settlement data.

```
POST /api/lmecashcal
```

#### Response

```json
{
  "success": true,
  "message": "LME cash settlement calculated and stored successfully"
}
```

### Update LME West Metal Price

Updates the LME West Metal Price data and triggers a calculation.

```
POST /api/lmecashcal?action=update-lme-west
```

#### Request Body

```json
{
  "date": "2023-05-30",
  "price": 2500.50
}
```

#### Response

```json
{
  "success": true,
  "message": "LME West Metal Price updated successfully and calculation triggered",
  "data": {
    "lmeWestRecord": {
      // record details
    }
  }
}
```

### Update RBI Rate

Updates the RBI Rate data and triggers a calculation.

```
POST /api/lmecashcal?action=update-rbi-rate
```

#### Request Body

```json
{
  "date": "2023-05-30",
  "rate": 82.5
}
```

#### Response

```json
{
  "success": true,
  "message": "RBI Rate updated successfully and calculation triggered",
  "data": {
    "rbiRateRecord": {
      // record details
    }
  }
}
```

### Scheduler Endpoint

Checks for and processes new data. Can be called by a cron job or scheduler.

```
GET /api/lmecashcal?action=scheduler&key=scheduler-secret-key
```

#### Response

```json
{
  "success": true,
  "message": "New data detected and processed",
  "data": {
    "processed": true
  }
}
```

Or if no new data is available:

```json
{
  "success": true,
  "message": "No new data to process",
  "data": {
    "processed": false
  }
}
```

## Calculation Logic

The LME Cash Settlement calculation is performed as follows:

1. **Retrieve Data**: Get the latest LME West Metal Price and RBI Rate data
2. **Match by Date**: For accurate calculations, records are matched by date (ignoring time components)
3. **Calculate Differences**:
   - Dollar Difference = price_today - price_yesterday
   - INR Difference = (price_today × RBI_today × 1.0825) - (price_yesterday × RBI_yesterday × 1.0825)
4. **Store Results**: Create or update an entry in the LMECashSettlement table

## Setting Up the Scheduler

To ensure that calculations are performed regularly, set up a cron job or scheduler to call the scheduler endpoint at regular intervals (e.g., hourly).

### Example using cron (Linux/Unix):

```sh
0 * * * * curl -X GET "https://yourdomain.com/api/lmecashcal?action=scheduler&key=scheduler-secret-key"
```

### Example using Windows Task Scheduler:

Set up a task to run a PowerShell script:

```powershell
Invoke-WebRequest -Method GET -Uri "https://yourdomain.com/api/lmecashcal?action=scheduler&key=scheduler-secret-key"
```

## Security

- The scheduler endpoint is protected with an API key that should be configured through the environment variable `SCHEDULER_KEY`
- If not set, it defaults to `scheduler-secret-key` (which should be changed in production)
- All endpoints include proper validation for input data

## Error Handling

All endpoints include robust error handling and will return appropriate error messages and status codes if issues occur.

## Data Validation

- Price values must be valid numbers
- Rate values must be valid numbers
- Date values are expected to be in string format
- All required fields are validated before processing 