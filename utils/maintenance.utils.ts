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
        }

        // Always submit/close this screen, whether or not anything was
        // checked - otherwise the "Plan bulk check" button stays in the DOM
        // and collides with the " Plan" menu button repairPlanes() clicks
        // next (Playwright's role-name matching is substring-based, so
        // "Plan bulk check" also matches a query for " Plan").
        await this.page.getByRole('button', { name: 'Plan bulk check' }).click();

        return clicked;
    }
}
