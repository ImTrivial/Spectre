import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";

require('dotenv').config();

export class FleetUtils {
    page : Page;

    // Not a normal operating limit — 20 planes depart per click, so a large
    // fleet (thousands of planes) can legitimately need hundreds of loops.
    // This only exists as a last-resort guard against a genuine infinite
    // loop (e.g. the page state getting stuck) rather than as a cap on how
    // many planes get departed.
    private static readonly SAFETY_MAX_ITERATIONS = 1000;

    constructor(page : Page) {
        this.page = page;
    }

    /**
     * Returns the number of "depart 20-or-less" batches actually clicked
     * this call, so callers can report roughly how many planes went out
     * (batches * up to 20 - this counts clicks, not confirmed departures,
     * since the page doesn't expose an exact per-click count).
     */
    public async departPlanes(): Promise<number> {
        let departAllVisible = await this.page.locator('#departAll').isVisible();
        console.log('Looking if there are any planes to be departed...')

        let count = 0;
        while(departAllVisible) {
            if (count >= FleetUtils.SAFETY_MAX_ITERATIONS) {
                console.warn(`Hit safety limit of ${FleetUtils.SAFETY_MAX_ITERATIONS} depart iterations - stopping to avoid an infinite loop. If you have a fleet this large, raise SAFETY_MAX_ITERATIONS.`);
                break;
            }

            console.log('Departing 20 or less...');

            const departAll = this.page.locator('#departAll');

            await departAll.click();
            await GeneralUtils.sleep(1500);

            const cantDepartPlane = await this.page.getByText('×Unable to departSome A/C was').isVisible();
            if(cantDepartPlane)
                break;

            departAllVisible = await this.page.locator('#departAll').isVisible();
            count++;

            console.log('Departed 20 or less planes...')
        }

        return count;
    }
}
