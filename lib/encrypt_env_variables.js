import request from 'superagent-promise';
import openpgp from 'openpgp';
import Debug from 'debug';

let debug = Debug('docker-worker-ci:encryptEnvVariable');

export async function encryptEnvVariables(task, envs, publicKeyUrl) {
  let response = await request.get(publicKeyUrl).buffer().end();

  if (!response.ok) {
    throw new Error('Could not retrieve public key to encrypt environment variables');
  }

  let pubKey = openpgp.key.readArmored(response.text);
  let unencryptedPayload = [];

  for (let env in envs) {
    unencryptedPayload.push({
      messageVersion: '1',
      taskId: task.taskId,
      startTime: task.task.created.getTime(),
      endTime: task.task.deadline.getTime(),
      name: env,
      value: envs[env]
    });
  }
  debug(unencryptedPayload);

  let encryptedPayload = await Promise.all(unencryptedPayload.map(async (message) => {
    message = JSON.stringify(message);
    let encryptedMessage = await openpgp.encryptMessage(pubKey.keys, message);
    let unarmoredEncryptedData = openpgp.armor.decode(encryptedMessage).data;
    let result = new Buffer(unarmoredEncryptedData).toString('base64');
    return result;
  }));

  return encryptedPayload;
}
