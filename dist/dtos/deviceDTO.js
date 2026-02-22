"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceDTO = void 0;
class DeviceDTO {
    constructor(device) {
        this.id = device.id;
        this.cum_energy = device.cum_energy;
        this.lat = device.lat;
        this.long = device.long;
        this.box_status = device.box_status;
    }
}
exports.DeviceDTO = DeviceDTO;
