const AWS = require('aws-sdk');
const localEnvInfo = require('../../amplify/.config/local-env-info.json');
const localAwsInfo = require('../../amplify/.config/local-aws-info.json');
const amplifyMeta = require('../../amplify/backend/amplify-meta.json');
const { readdirSync } = require('fs')
const { join, parse } = require('path');
const { v4: uuidv4 } = require('uuid');

const environmentName = localEnvInfo.envName;
const profileName = localAwsInfo[environmentName]?.profileName;

if (!profileName) {
  throw Error('Please reinitialize your Amplify project using your AWS profile');
}

for (const [apiName] of Object.entries(amplifyMeta.api)) {
  const providerName = amplifyMeta.api[apiName].providerPlugin;
  const databaseId = amplifyMeta.api[apiName].output.GraphQLAPIIdOutput;
  const region = amplifyMeta.providers[providerName].Region;

  AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: profileName });
  AWS.config.update({ region: region })
  const documentClient = new AWS.DynamoDB.DocumentClient();

  const writeParams = {
    RequestItems: {}
  };
  const baseTableNames = readdirSync(join(__dirname, 'fixtures', apiName)).map((filename) => parse(filename).name);
  for (const baseTableName of baseTableNames) {
    const fullTableName = `${baseTableName}-${databaseId}-${environmentName}`;
    const tableItems = require(`./fixtures/${apiName}/${baseTableName}.json`);
    writeParams.RequestItems[fullTableName] = tableItems.map((tableItem) => ({
      PutRequest: {
        Item: {
          id: uuidv4(),
          __typename: baseTableName,
          _lastChangedAt: new Date().getTime(),
          _version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...tableItem
        }
      }
    }));
  }

  documentClient.batchWrite(writeParams, (error, data) => {
    if (error) {
      console.error('Error in batch write', error);
    } else {
      console.error('Successfully executed batch write', data);
    }
  });
}
