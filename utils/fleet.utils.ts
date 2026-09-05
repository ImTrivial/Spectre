import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";

require('dotenv').config();

export interface DepartResult {
    // Number of "depart 20-or-less" batches actually clicked this call.
    batches: number;
    // true if the queue was genuinely empty (or hit the "unable to depart"
    // wall) when this call stopped - false if it stopped only because it
    // hit maxBatches, meaning there may still be more planes to depart.
    exhausted: boolean;
}

export class FleetUtils {
    page : Page;

    // Used only when no maxBatches is passed in - a last-resort guard
    // against a genuine infinite loop, not a normal operating limit.
    private static readonly SAFETY_MAX_ITERATIONS = 1000;

    constructor(page : Page) {
        this.page = page;
    }

    /**
     * Departs planes in batches of 20-or-less until either the queue is
     * empty, the game reports it can't depart further (e.g. no fuel/crew),
     * or maxBatches is reached (whichever comes first). Pass a small
     * maxBatches (e.g. 5 = ~100 planes) to cap how long a single call can
     * run, so one pass can't consume an entire test run on a huge or
     * continuously-refilling fleet.
     */
    public async departPlanes(maxBatches?: number): Promise<DepartResult> {
        const cap = maxBatches ?? FleetUtils.SAFETY_MAX_ITERATIONS;

        let departAllVisible = await this.page.locator('#departAll').isVisible();
        console.log('Looking if there are any planes to be departed...')

        let count = 0;
        while(departAllVisible) {
            if (count >= cap) {
                console.log(`Reached this pass's batch cap (${cap}) - stopping here, there may be more to depart.`);
                return { batches: count, exhausted: false };
            }

            console.log('Departing 20 or less...');

            const departAll = this.page.locator('#departAll');

            await departAll.click();
            await GeneralUtils.sleep(1500);

            const cantDepartPlane = await this.page.getByText('×Unable to departSome A/C was').isVisible();
            if(cantDepartPlane) {
                return { batches: count, exhausted: true };
            }

            departAllVisible = await this.page.locator('#departAll').isVisible();
            count++;

            console.log('Departed 20 or less planes...')
        }

        return { batches: count, exhausted: true };
    }
}
