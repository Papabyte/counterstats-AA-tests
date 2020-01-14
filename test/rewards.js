const path = require('path')
// eslint-disable-next-line no-unused-vars
const { Testkit, Utils } = require('aa-testkit')
const { Network } = Testkit({
	TESTDATA_DIR: path.join(__dirname, '../testdata'),
})

const min_reward = 10e6;
const min_stake = 1e6;
const coeff = 1.5;
const challenge_period = 3600

describe('Check AA counterstats rewards', function () {
	this.timeout(120 * 1000)

	before(async () => {
		this.network = await Network.create()
		this.explorer = await this.network.newObyteExplorer().ready()
		this.genesis = await this.network.getGenesisNode().ready()
		this.deployer = await this.network.newHeadlessWallet().ready()

		this.reporter_1 = await this.network.newHeadlessWallet().ready()
		this.reporter_2 = await this.network.newHeadlessWallet().ready()
		this.donor_1 = await this.network.newHeadlessWallet().ready()
		this.donor_2 = await this.network.newHeadlessWallet().ready()
		this.controler = await this.network.newHeadlessWallet().ready()

		await this.genesis.sendBytes({
			toAddress: await this.deployer.getAddress(),
			amount: 1e9,
		})
		await this.genesis.sendBytes({
			toAddress: await this.reporter_1.getAddress(),
			amount: 1e9,
		})
		await this.genesis.sendBytes({
			toAddress: await this.reporter_2.getAddress(),
			amount: 1e9,
		})
		await this.genesis.sendBytes({
			toAddress: await this.donor_1.getAddress(),
			amount: 1e9,
		})
		const { unit, error } = 	await this.genesis.sendBytes({
			toAddress: await this.donor_2.getAddress(),
			amount: 1e9,
		})

		await this.genesis.sendBytes({
			toAddress: await this.controler.getAddress(),
			amount: 1e9,
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		await this.network.witnessUntilStable(unit)

	})


	it('Deploy counterstats AA', async () => {
		const { address, unit, error } = await this.deployer.deployAgent(path.join(__dirname, './agents/counterstats.agent'))

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		expect(address).to.be.validAddress

		this.aaAddress = address

		await this.network.witnessUntilStable(unit)
	})

	it('set min reward without control address set', async () => {
		const { unit, error } = await this.controler.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				min_reward: min_reward
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('you are not control address')
	})

	it('set min stake without control address set', async () => {
		const { unit, error } = await this.controler.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				min_stake: min_stake
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('you are not control address')
	})

	it('set invalid control address', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				control_address: "gezheHTJMJL"
			},
		})
		
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('new control address is not a valid address')
	})

	it('set control address', async () => {
		const control_address = await this.controler.getAddress()
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				control_address: control_address
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false
		expect(response.response.responseVars.new_control_address).to.be.equal(control_address)
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)
		expect(vars["control_address"]).to.be.equal(control_address);
	})

	it('set min reward with wrong address', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				min_reward: min_reward
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('you are not control address')
	})

	it('set min stake with wrong address', async () => {
		const { unit, error } = await this.reporter_2.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				min_stake: min_stake
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('you are not control address')
	})

	it('set min reward', async () => {
		const { unit, error } = await this.controler.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				min_reward: min_reward
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false
		expect(response.response.responseVars.new_min_reward).to.be.equal(min_reward)
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)
		expect(vars["min_reward"]).to.be.equal(min_reward.toString());
	})

	it('set min stake', async () => {
		const { unit, error } = await this.controler.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				min_stake: min_stake
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false
		expect(response.response.responseVars.new_min_stake).to.be.equal(min_stake)
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)
		expect(vars["min_stake"]).to.be.equal(min_stake.toString());
	})

	it('donor_1 sends a reward for any exchange', async () => {
		const paymentAmount = 100e6
		const { unit, error } = await this.donor_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: paymentAmount,
			data: {
				reward_amount: 20e6,
				number_of_rewards: 5
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false
		expect(response.response.responseVars.created_pool).to.be.equal(1)
		expect(response.response.responseVars.amount).to.be.equal(paymentAmount)
		expect(response.response.responseVars.message).to.be.equal("created a reward pool 1 of 100000000 bytes")


		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars['pool_id']).to.be.equal("1");
		expect(vars["pool_1_sponsor"]).to.be.equal(await this.donor_1.getAddress());
		expect(vars["pool_1_reward_amount"]).to.be.equal("20000000");
		expect(vars["pool_1_number_of_rewards"]).to.be.equal("5");

	})

	it('donor_2 sends a reward for bittrex exchange', async () => {
		const paymentAmount = 50e6
		const { unit, error } = await this.donor_2.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: paymentAmount,
			data: {
				reward_amount: 25e6,
				number_of_rewards: 2,
				exchange: 'bittrex'
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false

		expect(response.response.responseVars.created_pool).to.be.equal(2)
		expect(response.response.responseVars.amount).to.be.equal(paymentAmount)
		expect(response.response.responseVars.message).to.be.equal("created a reward pool 2 of 50000000 bytes")


		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars['pool_id']).to.be.equal("2");
		expect(vars["pool_2_sponsor"]).to.be.equal(await this.donor_2.getAddress());
		expect(vars["pool_2_reward_amount"]).to.be.equal("25000000");
		expect(vars["pool_2_number_of_rewards"]).to.be.equal("2");

	})

	it('reward not integer', async () => {
		const paymentAmount = 10e6
		const { unit, error } = await this.donor_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: paymentAmount,
			data: {
				reward_amount: 2000000.5,
				number_of_rewards: 5
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("reward_amount must be an integer")

	})


	it('reward string not integer', async () => {
		const paymentAmount = 10e6
		const { unit, error } = await this.donor_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: paymentAmount,
			data: {
				reward_amount: "2000000.5",
				number_of_rewards: 5
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("reward_amount must be an integer")

	})


	it('number_of_rewards not integer', async () => {
		const paymentAmount = 10e6
		const { unit, error } = await this.donor_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: paymentAmount,
			data: {
				reward_amount: 20000000,
				number_of_rewards: 4.9
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("number_of_rewards must be an integer")

	})

	it('reward amount too low', async () => {
		const paymentAmount = min_reward -1
		const { unit, error } = await this.donor_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: paymentAmount,
			data: {
				reward_amount: min_reward - 1,
				number_of_rewards: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('reward_amount must be at least '+ min_reward + ' bytes')

	})

	it('donor_2 withdraws not existing pool', async () => {
		const { unit, error } = await this.donor_2.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				withdraw_pool: 1,
				pool_id: 5
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('no such pool: 5')

	})

	it('donor_2 withdraws wrong pool', async () => {
		const { unit, error } = await this.donor_2.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				withdraw_pool: 1,
				pool_id: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('not your pool: 1')

	})

	it('donor_1 withdraws', async () => {
		const { unit, error } = await this.donor_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				withdraw_pool: 1,
				pool_id: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		expect(response.bounced).to.be.false

		expect(response.response.responseVars.destroyed_pool).to.be.equal(1)
		expect(response.response.responseVars.amount).to.be.equal(100e6)
		expect(response.response.responseVars.message).to.be.equal("destroyed reward pool 1")

		await this.network.witnessUntilStable(response.response_unit)

		const { unitObj: payoutUnit, error: payoutError } = await this.deployer.getUnitInfo({ unit: response.response_unit })
		expect(payoutError).to.be.null
		const address_donor_1 = await this.donor_1.getAddress()
		const paymentMessage = payoutUnit.unit.messages.find(m => m.app === 'payment')
		const payout = paymentMessage.payload.outputs.find(out => address_donor_1.includes(out.address))
		expect(payout.amount).to.be.equal(100e6)

		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars['pool_id']).to.be.equal("2");
		expect(vars["pool_1_sponsor"]).to.be.equal(await this.donor_1.getAddress());
		expect(vars["pool_1_reward_amount"]).to.be.equal("20000000");
		expect(vars["pool_1_number_of_rewards"]).to.be.undefined

	})


	it('reporter 1 no reward', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bitforex',
				pool_id: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("pool 1 doesn't exist or is empty")

	})

	it('reporter 1 no reward', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bitforex',
				pool_id: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("pool 1 doesn't exist or is empty")

	})

	it('reporter 1 wrong pool reward', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bitforex',
				pool_id: 2
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("pool 2 is for exchange bittrex only")

	})


	it('reporter 1 use pool 2', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bittrex',
				pool_id: 2
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.false
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars['pool_id']).to.be.equal("2");
		expect(vars["pool_2_sponsor"]).to.be.equal(await this.donor_2.getAddress());
		expect(vars["pool_2_reward_amount"]).to.be.equal("25000000");
		expect(vars["pool_2_number_of_rewards"]).to.be.equal("1");

	})

	it('reporter 1 pool not integer', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8010,
				exchange: 'bitforex',
				pool_id: '2.5'
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("pool_id must be an integer")

	})

	it('reporter 2 counterstakes pool 2', async () => {
		const { unit, error } = await this.reporter_2.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake * coeff,
			data: {
				remove_wallet_id: 8000,
				exchange: 'bittrex'
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.false
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars['pool_id']).to.be.equal("2");
		expect(vars["pool_2_sponsor"]).to.be.equal(await this.donor_2.getAddress());
		expect(vars["pool_2_reward_amount"]).to.be.equal("25000000");
		expect(vars["pool_2_number_of_rewards"]).to.be.equal("1");

	})

	it('commit pool 2', async () => {
		await this.network.timetravel({ shift: (challenge_period*1.05)+'s' })
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				commit: 1,
				exchange: 'bittrex',
				remove_wallet_id: 8000
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.false
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars['pool_id']).to.be.equal("2");
		expect(vars["pool_2_sponsor"]).to.be.equal(await this.donor_2.getAddress());
		expect(vars["pool_2_reward_amount"]).to.be.equal("25000000");
		expect(vars["pool_2_number_of_rewards"]).to.be.equal("2");

	})

	it('donor_1 sends a reward for any exchange', async () => {
		const paymentAmount = 100e6
		const { unit, error } = await this.donor_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: paymentAmount,
			data: {
				reward_amount: 20e6,
				number_of_rewards: 5
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false

		expect(response.response.responseVars.created_pool).to.be.equal(3)
		expect(response.response.responseVars.amount).to.be.equal(paymentAmount)
		expect(response.response.responseVars.message).to.be.equal("created a reward pool 3 of 100000000 bytes")


		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars['pool_id']).to.be.equal("3");
		expect(vars["pool_3_sponsor"]).to.be.equal(await this.donor_1.getAddress());
		expect(vars["pool_3_reward_amount"]).to.be.equal("20000000");
		expect(vars["pool_3_number_of_rewards"]).to.be.equal("5");

	})

	it('reporter 1 use pool 3', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 800055,
				exchange: 'bittrex',
				pool_id: 3
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.false
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars['pool_id']).to.be.equal("3");
		expect(vars["pool_3_sponsor"]).to.be.equal(await this.donor_1.getAddress());
		expect(vars["pool_3_reward_amount"]).to.be.equal("20000000");
		expect(vars["pool_3_number_of_rewards"]).to.be.equal("4");

	})

	it('set control address wrong control address', async () => {
		const control_address = await this.reporter_1.getAddress()
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				control_address: control_address
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal('you are not control address')
	})

	it('controler gives control to reporter 1', async () => {
		const control_address = await this.reporter_1.getAddress()
		const { unit, error } = await this.controler.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				control_address: control_address
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false
		expect(response.response.responseVars.new_control_address).to.be.equal(control_address)
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)
		expect(vars["control_address"]).to.be.equal(control_address);
	})

	it('set min reward', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				min_reward: 800000
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false
		expect(response.response.responseVars.new_min_reward).to.be.equal(800000)
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)
		expect(vars["min_reward"]).to.be.equal('800000');
	})

	it('set min stake', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				min_reward: 189166
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)

		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.false
		expect(response.response.responseVars.new_min_reward).to.be.equal(189166)
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)
		expect(vars["min_reward"]).to.be.equal('189166');
	})

	after(async () => {
		// uncomment this line to pause test execution to get time for Obyte DAG explorer inspection
		//await Utils.sleep(3600 * 1000)
		await this.network.stop()
	})
})
