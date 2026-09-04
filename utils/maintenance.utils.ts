import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";

export class MaintenanceUtils {
    page : Page;

    constructor(page : Page) {
        this.page = page;
    }

    public async repairPlanes(): Promise<boolean> {
        await this.page.getByRole('button', { name: ' Plan' }).click();
        await this.page.getByRole('button', { name: ' Bulk repair' }).click();
        await this.page.locator('#repairPct').selectOption('60');
        await GeneralUtils.sleep(1000);
        const noPlaneExists = await this.page.getByText('There are no aircraft worn to').isVisible();
        if(!noPlaneExists) {
            await this.page.getByRole('button', { name: 'Plan bulk repair' }).click();
            return true;
        }
        return false;
    }

    public async checkPlanes(): Promise<boolean> {
        await this.page.getByRole('button', { name: ' Plan' }).click();
        await this.page.getByRole('button', { name: ' Bulk check' }).click();

        await GeneralUtils.sleep(2000);
        let clicked = false;

        // Click only planes with danger text
        const dangerChecksExits = await this.page.locator('.bg-white > .text-danger').first().isVisible();
        if(dangerChecksExits) {
            const allCheckHoursDanger = this.page.locator('.bg-white > .text-danger');
            const count = await allCheckHoursDanger.count();
            for(let i = 0; i < count; i++) {
                await allCheckHoursDanger.first().click();
                clicked = true;

                await GeneralUtils.sleep(500);
            }

            // Only submit when something was actually selected - submitting
            // with zero selections appears to trigger an empty-state banner
            // that visually covers this button, which then blocks every
            // future click attempt on it until the page timeout.
            await this.page.getByRole('button', { name: 'Plan bulk check' }).click();
            await GeneralUtils.sleep(500);
        }

        // Re-open the "Plan" menu to back out of the Bulk check subview,
        // whether or not we submitted. This resets the screen so the
        // "Plan bulk check" button isn't left sitting in the DOM to collide
        // with repairPlanes()'s click on " Plan" right after (Playwright's
        // role-name matching is substring-based, so "Plan bulk check" also
        // matches a query for " Plan").
        await this.page.getByRole('button', { name: ' Plan' }).click();

        return clicked;
    }
}
