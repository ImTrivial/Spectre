import { Locator, Page } from "@playwright/test";
import { ConfigUtils } from "./config.utils";

require('dotenv').config();

export interface Purchase {
    amount: number;
    price: number;
}

interface ResourceConfig {
    label: string;
    maxPrice: number;
    holdingThreshold: number;
    emergencyPrice: number;
    emergencyAmount: number;
}

export class FuelUtils {
    maxFuelPrice: number;
    maxCo2Price: number;

    page: Page;

    // Fallback purchase amounts/thresholds used when the market price is above
    // our target but supplies are nearly empty (better to overpay than to be stranded).
    private static readonly FUEL_HOLDING_THRESHOLD = 2_000_000;
    private static readonly FUEL_EMERGENCY_PRICE = 1250;
    private static readonly CO2_HOLDING_THRESHOLD = 1_000_000;
    private static readonly CO2_EMERGENCY_PRICE = 180;

    constructor(page: Page) {
        this.maxFuelPrice = ConfigUtils.requireNumber('MAX_FUEL_PRICE');
        this.maxCo2Price = ConfigUtils.requireNumber('MAX_CO2_PRICE');
        this.page = page;

        console.log(`Max Fuel Price: ${this.maxFuelPrice}`);
        console.log(`Max Co2 Price: ${this.maxCo2Price}`);
    }

    private async parseNumber(locator: Locator): Promise<number> {
        const text = (await locator.innerText()).replaceAll(',', '');
        return parseInt(text, 10);
    }

    private async purchase(amount: string) {
        const amountInput = this.page.getByPlaceholder('Amount to purchase');
        await amountInput.click();
        await amountInput.press('Control+a');
        await amountInput.fill(amount);
        await this.page.getByRole('button', { name: ' Purchase' }).click();
    }

    private async buyResource(config: ResourceConfig): Promise<Purchase | null> {
        console.log(`Buying ${config.label}...`);

        const emptyCapacity = await this.parseNumber(this.page.locator('#remCapacity'));
        if (emptyCapacity === 0) {
            return null;
        }

        const currentPrice = await this.parseNumber(this.page.getByText('Total price$').locator('b > span'));
        const currentHolding = await this.parseNumber(this.page.locator('#holding'));

        console.log(`Current ${config.label} Price: ${currentPrice}`);

        if (currentPrice < config.maxPrice) {
            await this.purchase(emptyCapacity.toString());
            console.log(`Bought ${config.label} Successfully! Amount bought: ${emptyCapacity}`);
            return { amount: emptyCapacity, price: currentPrice };
        } else if (currentHolding < config.holdingThreshold && currentPrice < config.emergencyPrice) {
            await this.purchase(config.emergencyAmount.toString());
            console.log(`Bought ${config.label} Successfully! Amount bought: ${config.emergencyAmount}`);
            return { amount: config.emergencyAmount, price: currentPrice };
        }

        return null;
    }

    public buyFuel() {
        return this.buyResource({
            label: 'Fuel',
            maxPrice: this.maxFuelPrice,
            holdingThreshold: FuelUtils.FUEL_HOLDING_THRESHOLD,
            emergencyPrice: FuelUtils.FUEL_EMERGENCY_PRICE,
            emergencyAmount: FuelUtils.FUEL_HOLDING_THRESHOLD,
        });
    }

    public buyCo2() {
        return this.buyResource({
            label: 'Co2',
            maxPrice: this.maxCo2Price,
            holdingThreshold: FuelUtils.CO2_HOLDING_THRESHOLD,
            emergencyPrice: FuelUtils.CO2_EMERGENCY_PRICE,
            emergencyAmount: FuelUtils.CO2_HOLDING_THRESHOLD,
        });
    }
}
