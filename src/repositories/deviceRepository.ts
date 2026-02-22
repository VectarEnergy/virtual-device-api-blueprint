export interface VictronDevice {
  id: string;
  cum_energy: number;
  lat: number;
  long: number;
  box_status: string;
}

export class DeviceRepository {
  static transformVictronData(data: any[]): VictronDevice[] {
    return data.map(item => ({
      id: item.device_id,
      cum_energy: item.cum_energy,
      lat: item.lat,
      long: item.long,
      box_status: item.box_status
    }));
  }
}
