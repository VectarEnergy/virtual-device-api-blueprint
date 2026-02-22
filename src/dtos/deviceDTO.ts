import { VictronDevice } from '../repositories/deviceRepository';

export class DeviceDTO {
  id: string;
  cum_energy: number;
  lat: number;
  long: number;
  box_status: string;

  constructor(device: VictronDevice) {
    this.id = device.id;
    this.cum_energy = device.cum_energy;
    this.lat = device.lat;
    this.long = device.long;
    this.box_status = device.box_status;
  }
}
