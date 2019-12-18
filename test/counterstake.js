const path = require('path')
// eslint-disable-next-line no-unused-vars
const { Testkit, Utils } = require('aa-testkit')
const { Network } = Testkit({
	TESTDATA_DIR: path.join(__dirname, '../testdata'),
})

const min_reward = 10e6
const min_stake = 1e6
const coeff = 1.5
const challenge_period_length = 3600
const overpayment_fee = 1000

describe('Check AA counterstats rewards', function () {
	this.timeout(120 * 1000)

	before(async () => {
		this.network = await Network.create()
		this.explorer = await this.network.newObyteExplorer().ready()
		this.genesis = await this.network.getGenesisNode().ready()
		this.deployer = await this.network.newHeadlessWallet().ready()

		this.reporter_1 = await this.network.newHeadlessWallet().ready()
		this.reporter_2 = await this.network.newHeadlessWallet().ready()
		this.reporter_3 = await this.network.newHeadlessWallet().ready()

		this.donor_1 = await this.network.newHeadlessWallet().ready()

		const { unit, error } = await this.genesis.sendBytes({
			toAddress: await this.deployer.getAddress(),
			amount: 1e9,
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		await this.network.witnessUntilStable(unit)

		const balance = await this.deployer.getBalance()
		expect(balance.base.stable).to.be.equal(1e9)
	})

	it('Send bytes to reporter_1', async () => {
		const { unit, error } = await this.genesis.sendBytes({
			toAddress: await this.reporter_1.getAddress(),
			amount: 1e9,
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		await this.network.witnessUntilStable(unit)
		const balance = await this.reporter_1.getBalance()
		expect(balance.base.stable).to.be.equal(1e9)
	})

	it('Send bytes to reporter_2', async () => {
		const { unit, error } = await this.genesis.sendBytes({
			toAddress: await this.reporter_2.getAddress(),
			amount: 1e9,
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		await this.network.witnessUntilStable(unit)
		const balance = await this.reporter_2.getBalance()
		expect(balance.base.stable).to.be.equal(1e9)
	})

	it('Send bytes to donor 1', async () => {
		const { unit, error } = await this.genesis.sendBytes({
			toAddress: await this.donor_1.getAddress(),
			amount: 1e9,
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		await this.network.witnessUntilStable(unit)
		const balance = await this.donor_1.getBalance()
		expect(balance.base.stable).to.be.equal(1e9)
	})

	it('Deploy counterstats AA', async () => {
		const { address, unit, error } = await this.deployer.deployAgent(path.join(__dirname, './agents/counterstats.agent'))

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		expect(address).to.be.validAddress

		this.aaAddress = address

		await this.network.witnessUntilStable(unit)
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
		expect(response.response.responseVars.your_address).to.be.equal(await this.donor_1.getAddress())
		expect(response.response.responseVars.message).to.be.equal("created a reward pool 1 of 100000000 bytes")
		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)
		expect(vars['pool_id']).to.be.equal("1");
		expect(vars["pool_1_sponsor"]).to.be.equal(await this.donor_1.getAddress());
		expect(vars["pool_1_reward_amount"]).to.be.equal("20000000");
		expect(vars["pool_1_number_of_rewards"]).to.be.equal("5");

	})

	it('reporter 1 add a wallet to bittrex', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bittrex',
				pool_id: 1,
				url_1: 'http://url1.com',
				url_2: 'http://url2.com',
				url_3: 'http://url3.com',
				url_4: 'http://url4.com',
				url_5: 'http://url5.com',

			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.responseVars["pool_id"]).to.be.equal(1)
		expect(response.response.responseVars["expected_reward"]).to.be.equal(20000000)
		expect(response.response.responseVars["proposed_outcome"]).to.be.equal("in")
		expect(response.response.responseVars["countdown_started"]).to.be.equal(true)
		expect(response.response.responseVars["outcome"]).to.be.equal("in")
		expect(response.response.responseVars["operation_id"]).to.be.equal("k_bittrex_8000_1")
		expect(response.response.responseVars["staked_on_in"]).to.be.equal(min_stake)
		expect(response.response.responseVars["staked_on_out"]).to.be.equal(0)
		expect(response.response.responseVars["your_address"]).to.be.equal(await this.reporter_1.getAddress())
		expect(response.response.responseVars["your_stake"]).to.be.equal(min_stake)
		expect(response.response.responseVars["accepted_amount"]).to.be.equal(min_stake)

		expect(response.bounced).to.be.false

		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars["pool_1_number_of_rewards"]).to.be.equal("4");

		expect(vars["p_bittrex_8000_exchange"]).to.be.equal("bittrex")
		expect(vars["p_bittrex_8000_wallet_id"]).to.be.equal("8000")
		expect(vars["p_bittrex_8000_number"]).to.be.equal("1")
		expect(vars["k_bittrex_8000_1"]).to.be.equal("onreview")
		expect(vars["k_bittrex_8000_1_initial_outcome"]).to.be.equal("in")
		expect(vars["k_bittrex_8000_1_initial_reporter"]).to.be.equal(await this.reporter_1.getAddress())
		expect(vars["k_bittrex_8000_1_pool_id"]).to.be.equal("1")
		expect(vars["k_bittrex_8000_1_url_proof_for_in_1"]).to.be.equal("http://url1.com")
		expect(vars["k_bittrex_8000_1_url_proof_for_in_2"]).to.be.equal("http://url2.com")
		expect(vars["k_bittrex_8000_1_url_proof_for_in_3"]).to.be.equal("http://url3.com")
		expect(vars["k_bittrex_8000_1_url_proof_for_in_4"]).to.be.equal("http://url4.com")
		expect(vars["k_bittrex_8000_1_url_proof_for_in_5"]).to.be.equal("http://url5.com")
		expect(vars["k_bittrex_8000_1_url_id_proof_for_in"]).to.be.equal("5")
		expect(vars["k_bittrex_8000_1_total_staked"]).to.be.equal(min_stake.toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_in"]).to.be.equal(min_stake.toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_in_by_" + (await this.reporter_1.getAddress())]).to.be.equal(min_stake.toString())

	})


	it('reporter 1 forgets wallet id', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				exchange: 'bitforex',
				pool_id: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true

	})

	it('reporter 1 wallet id too long', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				exchange: 'bitforex',
				pool_id: 1,
				add_wallet_id: 1e14 + 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("wallet_id cannot be over 1e14")

	})

	it('reporter 2 remove not added', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				exchange: 'bitdumb',
				pool_id: 1,
				remove_wallet_id: 421588889
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("this wallet id is not active")

	})

	it('reporter 2 same position as current outcome', async () => {
		const { unit, error } = await this.reporter_2.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bittrex',
				pool_id: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)

		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("staking on the current outcome is not allowed")

	})

	it('reporter 1 url 1 too long', async () => {
		var url = ""
		for (var i=0;i<=256;i++)
			url += "u"
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bitforex',
				pool_id: 1,
				url_1: url
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("url_1 cannot be over 256 chars")

	})

	it('reporter 1 url 2 too long', async () => {
		var url = ""
		for (var i=0;i<=256;i++)
			url += "u"
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bitforex',
				pool_id: 1,
				url_2: url
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("url_2 cannot be over 256 chars")
	})

	it('reporter 1 url 3 too long', async () => {
		var url = ""
		for (var i=0;i<=256;i++)
			url += "u"
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bitforex',
				pool_id: 1,
				url_3: url
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("url_3 cannot be over 256 chars")
	})

	it('reporter 1 url 4 too long', async () => {
		var url = ""
		for (var i=0;i<=256;i++)
			url += "u"
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bitforex',
				pool_id: 1,
				url_4: url
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("url_4 cannot be over 256 chars")
	})

	it('reporter 1 url 5 too long', async () => {
		var url = ""
		for (var i=0;i<=256;i++)
			url += "u"
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: min_stake,
			data: {
				add_wallet_id: 8000,
				exchange: 'bitforex',
				pool_id: 1,
				url_5: url
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("url_5 cannot be over 256 chars")
	})

	const counterstake_1_rpt_2 = min_stake*coeff
	it('reporter 2 counterstake bittrex', async () => {
		const { unit, error } = await this.reporter_2.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: counterstake_1_rpt_2,
			data: {
				remove_wallet_id: 8000,
				exchange: 'bittrex',
				url_1: 'http://urlout1.com',
				url_2: 'http://urlout2.com'
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.responseVars["proposed_outcome"]).to.be.equal("out")
		expect(response.response.responseVars["countdown_started"]).to.be.equal(true)
		expect(response.response.responseVars["outcome"]).to.be.equal("out")
		expect(response.response.responseVars["operation_id"]).to.be.equal("k_bittrex_8000_1")
		expect(response.response.responseVars["staked_on_in"]).to.be.equal(min_stake)
		expect(response.response.responseVars["staked_on_out"]).to.be.equal(counterstake_1_rpt_2)
		expect(response.response.responseVars["your_address"]).to.be.equal(await this.reporter_2.getAddress())
		expect(response.response.responseVars["your_stake"]).to.be.equal(counterstake_1_rpt_2)
		expect(response.response.responseVars["accepted_amount"]).to.be.equal(counterstake_1_rpt_2)

		expect(response.bounced).to.be.false

		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars["pool_1_number_of_rewards"]).to.be.equal("4");

		expect(vars["p_bittrex_8000_exchange"]).to.be.equal("bittrex")
		expect(vars["p_bittrex_8000_wallet_id"]).to.be.equal("8000")
		expect(vars["p_bittrex_8000_number"]).to.be.equal("1")
		expect(vars["k_bittrex_8000_1"]).to.be.equal("onreview")
		expect(vars["k_bittrex_8000_1_initial_outcome"]).to.be.equal("in")
		expect(vars["k_bittrex_8000_1_initial_reporter"]).to.be.equal(await this.reporter_1.getAddress())
		expect(vars["k_bittrex_8000_1_pool_id"]).to.be.equal("1")
		expect(vars["k_bittrex_8000_1_url_proof_for_out_1"]).to.be.equal("http://urlout1.com")
		expect(vars["k_bittrex_8000_1_url_proof_for_out_2"]).to.be.equal("http://urlout2.com")
		expect(vars["k_bittrex_8000_1_url_id_proof_for_in"]).to.be.equal("5")
		expect(vars["k_bittrex_8000_1_url_id_proof_for_out"]).to.be.equal("2")
		expect(vars["k_bittrex_8000_1_total_staked"]).to.be.equal((min_stake + counterstake_1_rpt_2).toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_in"]).to.be.equal(min_stake.toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_out"]).to.be.equal(counterstake_1_rpt_2.toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_in_by_" + (await this.reporter_1.getAddress())]).to.be.equal(min_stake.toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_out_by_" + (await this.reporter_2.getAddress())]).to.be.equal(counterstake_1_rpt_2.toString())

	})

	const counterstake_2_rpt_1 = counterstake_1_rpt_2*coeff - min_stake 
	it('reporter 2 counterstake bittrex', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: counterstake_2_rpt_1 + 200000,
			data: {
				add_wallet_id: 8000,
				exchange: 'bittrex',
				url_1: 'http://urlin6.com'
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		const reporter_1_addr = await this.reporter_1.getAddress();
		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.responseVars["proposed_outcome"]).to.be.equal("in")
		expect(response.response.responseVars["countdown_started"]).to.be.equal(true)
		expect(response.response.responseVars["outcome"]).to.be.equal("in")
		expect(response.response.responseVars["operation_id"]).to.be.equal("k_bittrex_8000_1")
		expect(response.response.responseVars["staked_on_in"]).to.be.equal(min_stake + counterstake_2_rpt_1)
		expect(response.response.responseVars["staked_on_out"]).to.be.equal(counterstake_1_rpt_2)
		expect(response.response.responseVars["your_address"]).to.be.equal(reporter_1_addr)
		expect(response.response.responseVars["your_stake"]).to.be.equal(min_stake + counterstake_2_rpt_1)
		expect(response.response.responseVars["accepted_amount"]).to.be.equal(counterstake_2_rpt_1)

		expect(response.bounced).to.be.false

		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars["pool_1_number_of_rewards"]).to.be.equal("4");

		expect(vars["p_bittrex_8000_exchange"]).to.be.equal("bittrex")
		expect(vars["p_bittrex_8000_wallet_id"]).to.be.equal("8000")
		expect(vars["p_bittrex_8000_number"]).to.be.equal("1")
		expect(vars["k_bittrex_8000_1"]).to.be.equal("onreview")
		expect(vars["k_bittrex_8000_1_initial_outcome"]).to.be.equal("in")
		expect(vars["k_bittrex_8000_1_initial_reporter"]).to.be.equal(reporter_1_addr)
		expect(vars["k_bittrex_8000_1_pool_id"]).to.be.equal("1")
		expect(vars["k_bittrex_8000_1_url_proof_for_in_6"]).to.be.equal("http://urlin6.com")
		expect(vars["k_bittrex_8000_1_url_id_proof_for_in"]).to.be.equal("6")
		expect(vars["k_bittrex_8000_1_url_id_proof_for_out"]).to.be.equal("2")
		expect(vars["k_bittrex_8000_1_total_staked"]).to.be.equal((min_stake + counterstake_1_rpt_2 + counterstake_2_rpt_1).toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_in"]).to.be.equal((min_stake + counterstake_2_rpt_1).toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_out"]).to.be.equal(counterstake_1_rpt_2.toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_in_by_" + (reporter_1_addr)]).to.be.equal((min_stake + counterstake_2_rpt_1).toString())
		expect(vars["k_bittrex_8000_1_total_staked_on_out_by_" + (await this.reporter_2.getAddress())]).to.be.equal(counterstake_1_rpt_2.toString())
	
		const { unitObj: refundUnit, error: refundError } = await this.deployer.getUnitInfo({ unit: response.response_unit })
		expect(refundError).to.be.null

		const paymentMessage = refundUnit.unit.messages.find(m => m.app === 'payment')
		const refund = paymentMessage.payload.outputs.find(out => reporter_1_addr.includes(out.address))
		expect(refund.amount).to.be.equal(200000 - overpayment_fee)

	})

	it('commit too early 1', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				add_wallet_id: 8000,
				exchange: 'bittrex',
				commit: "1"
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("challenge period is still running")
	})

	it('commit too early 2', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				remove_wallet_id: 8000,
				exchange: 'bittrex',
				commit: true
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("challenge period is still running")
	})

	it('commit too early 3', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				operation_id: 'k_bittrex_8000_1',
				commit: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("challenge period is still running")
	})

	it('commit unknown key 1', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				operation_id: 'k_bittrex_8010_1',
				exchange: 'bittrex',
				commit: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("unknown operation")
	})


	it('commit unknown key 2', async () => {
		const { unit, error } = await this.reporter_1.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				remove_wallet_id: 1000,
				exchange: 'bittrex',
				commit: 1
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		expect(response.bounced).to.be.true
		expect(response.response.error).to.be.equal("unknown operation")
	})



	it('commit', async () => {
		const shift = (challenge_period_length+ 1000) + 's'
		await this.network.timetravel({ shift: shift})
		const { unit, error } = await this.reporter_2.triggerAaWithData({
			toAddress: this.aaAddress,
			amount: 10000,
			data: {
				add_wallet_id: 8000,
				exchange: 'bittrex',
				commit: "1"
			},
		})

		expect(error).to.be.null
		expect(unit).to.be.validUnit
		const reporter_1_addr = await this.reporter_1.getAddress();
		const { response } = await this.network.getAaResponseToUnit(unit)
		await this.network.witnessUntilStable(response.response_unit)
		const paid_out_amount = 20000000 + min_stake + counterstake_1_rpt_2 + counterstake_2_rpt_1
		expect(response.response.responseVars["paid_out_amount"]).to.be.equal(paid_out_amount)
		expect(response.response.responseVars["paid_out_address"]).to.be.equal(reporter_1_addr)
		expect(response.response.responseVars["committed_outcome"]).to.be.equal("in")
		expect(response.response.responseVars["pair"]).to.be.equal("p_bittrex_8000")
		expect(response.response.responseVars["operation_id"]).to.be.equal("k_bittrex_8000_1")

		expect(response.bounced).to.be.false

		const { vars } = await this.deployer.readAAStateVars(this.aaAddress)

		expect(vars["pool_1_number_of_rewards"]).to.be.equal("4");

		expect(vars["p_bittrex_8000_committed_outcome"]).to.be.equal("in")
		expect(vars["p_bittrex_8000_wallet_id"]).to.be.equal("8000")

		expect(vars["k_bittrex_8000_1_total_staked_on_in_by_" + (reporter_1_addr)]).to.be.undefined
		expect(vars["k_bittrex_8000_1_total_staked_on_out_by_" + (await this.reporter_2.getAddress())]).to.be.equal(counterstake_1_rpt_2.toString())
	
		const { unitObj: payoutUnit, error: payoutError } = await this.deployer.getUnitInfo({ unit: response.response_unit })
		expect(payoutError).to.be.null

		const paymentMessage = payoutUnit.unit.messages.find(m => m.app === 'payment')
		const payout = paymentMessage.payload.outputs.find(out => reporter_1_addr.includes(out.address))
		expect(payout.amount).to.be.equal(paid_out_amount)

		const payload = payoutUnit.unit.messages.find(m => m.app === 'data_feed')
		expect(payload.payload.bittrex).to.be.equal(8000)
	})

	after(async () => {
		// uncomment this line to pause test execution to get time for Obyte DAG explorer inspection
	//	await Utils.sleep(3600 * 1000)
		await this.network.stop()
	})
})
