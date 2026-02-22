"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceRepository = void 0;
class DeviceRepository {
    static transformVictronData(data) {
        return data.map(item => ({
            id: item.device_id,
            cum_energy: item.cum_energy,
            lat: item.lat,
            long: item.long,
            box_status: item.box_status
        }));
    }
}
exports.DeviceRepository = DeviceRepository;
