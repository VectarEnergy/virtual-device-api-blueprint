import { DeviceRepository } from '../repositories/deviceRepository';
import axios from 'axios';
import config from '../config/config';

export const fetchDevicesFromVictron = async () => {
  let response;
  let retry = true;
  let attempts = 0;
  while (retry && attempts < 3) {
    try {
      response = await axios.get(config.victronApiUrl, {
        headers: {
          'x-authorization': `Token ${process.env.VICTRON_API_TOKEN}`
        }
      });
      retry = false;
    } catch (err: any) {
      if (err.response && err.response.status === 429 && err.response.headers['retry-after']) {
        const wait = parseInt(err.response.headers['retry-after'], 10) * 1000;
        await new Promise(res => setTimeout(res, wait));
        attempts++;
      } else {
        throw err;
      }
    }
  }
  if (!response) throw new Error('Failed to fetch from Victron API after retries');
  return DeviceRepository.transformVictronData(response.data as any[]);
};

export const fetchUserMeFromVictron = async () => {
  let response;
  let retry = true;
  let attempts = 0;
  while (retry && attempts < 3) {
    try {
      response = await axios.get(`${process.env.BASE_URL}/users/me`, {
        headers: {
          'x-authorization': `Token ${process.env.VICTRON_API_TOKEN}`
        }
      });
      retry = false;
    } catch (err: any) {
      if (err.response && err.response.status === 429 && err.response.headers['retry-after']) {
        const wait = parseInt(err.response.headers['retry-after'], 10) * 1000;
        await new Promise(res => setTimeout(res, wait));
        attempts++;
      } else {
        throw err;
      }
    }
  }
  if (!response) throw new Error('Failed to fetch /users/me from Victron API after retries');
  return response.data;
};
