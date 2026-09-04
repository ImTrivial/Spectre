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

            // "Plan bulk check" sits in the DOM the whole time this tab is
            // open, whether or not anything's selected - it only goes away
            // once actually submitted. We only submit when something was
            // selected; the caller is responsible for fully closing and
            // reopening the maintenance popup afterward so this tab's state
            // (and this button) doesn't linger into the next screen.
            await this.page.getByRole('button', { name: 'Plan bulk check' }).click();
            await GeneralUtils.sleep(500);
        }

        return clicked;
    }
}
