constructor(page: Page) {
        if(process.env.INCREASE_AIRLINE_REPUTATION?.toLowerCase() === 'true') {
            this.increaseAirlineReputation = true;
            this.campaignType = ConfigUtils.requireNumber('CAMPAIGN_TYPE');
            this.campaignDuration = ConfigUtils.requireNumber('CAMPAIGN_DURATION');
        }

        this.page = page;
}
