# Snowflake JWT Authentication Script for Cribl

This script enables JWT authentication with a private key against Snowflake on a Cribl worker node. It's designed for polling Snowflake login history data.

## Overview

- **Authentication**: Uses JWT with RSA private key authentication
- **Purpose**: Polls Snowflake login history data for ingestion into Cribl
- **Limitation**: Currently scripted inputs do not support state tracking in Cribl (though the script itself can handle it if you find a workaround)
- **Default Query**: 
  ```sql
  SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY 
  WHERE EVENT_TIMESTAMP > ? 
  ORDER BY EVENT_TIMESTAMP;
  ```

## Setup Instructions

### 1. Deploy the Script

Place the script on a worker node accessible by the cribl user:
```bash
# Example location
/opt/cribl/scripts/snowsql.js
```
Don't forget to change permissions as needed. 

There is a dependency on the jsonwebtoken npm library. Deploy as you normally do or you can install like:

```bash
cd /opt/cribl/scripts/
npm install jsonwebtoken
```

### 2. Configure the Script

Update the following variables in the script (see CLAUDE.md for specific line numbers):
- Private key path
- Snowflake qualified username (ORG.USER)
- Snowflake warehouse name
- Snowflake role
- Snowflake hostname (YOUR-ORG.snowflakecomputing.com)

### 3. Create a Script Collector in Cribl

Configure a new Script collector with these settings:

**Discover Script:**
```bash
echo $NOW
```

**Collect Script:**
```bash
/$CRIBL_HOME/cribl node /path/to/snowsql.js --stateTracker $CRIBL_COLLECT_ARG --passphrase $PASSPHRASE 2>&1
```

**Environment Variables:**
- `NOW`: Set to `Date.now()-600000` (adjustable based on your polling interval)
  - This provides a timestamp 10 minutes in the past
  - Adjust the value based on your desired polling frequency
  
- `PASSPHRASE`: Your Snowflake SQL key passphrase
  - Example: `${C.Secret('snowflake-key-passphrase', 'text').value}`
  - Store securely using Cribl's secret management

**Pipeline Configuration:**
- Route the script output to your desired Cribl pipeline for processing

## How It Works

1. The discover script outputs the current timestamp minus your polling interval
2. This timestamp is passed to the collect script as `$CRIBL_COLLECT_ARG`
3. The script queries Snowflake for all login events after that timestamp
4. Results are output as newline-delimited JSON
5. The script tracks the last processed timestamp in `/tmp/statepoch` (for potential future state tracking)

## Output Format

Each login event is output as a JSON object with these fields:
- EVENT_ID
- EVENT_TIMESTAMP
- EVENT_TYPE
- USER_NAME
- CLIENT_IP
- REPORTED_CLIENT_TYPE
- REPORTED_CLIENT_VERSION
- FIRST_AUTHENTICATION_FACTOR
- SECOND_AUTHENTICATION_FACTOR
- IS_SUCCESS
- ERROR_CODE
- ERROR_MESSAGE
- RELATED_EVENT_ID
- CONNECTION
- CLIENT_PRIVATE_LINK_ID

## Troubleshooting

- Ensure the cribl user has read access to the private key file
- Verify all Snowflake configuration values are correct
- Check Cribl logs for authentication or connection errors
- Test the script manually first: `node snowsql.js --passphrase <your-passphrase> --stateTracker <timestamp>`