//! bloqvia-bounties — a bounty board owned by a DAO, paid by tier.
//!
//! Graduates are a cohort. A Sputnik DAO owns this board: it posts bounties
//! (through FunctionCall proposals, or the owner during setup), funds the
//! board's allowance with Transfer proposals, and approves the bigger rewards
//! with its own votes. The board checks **who qualified** against
//! `bloqvia-core`'s record (Passport level, completed quests, graduation) and
//! never asks a person or a model.
//!
//! * `claim_for(learner, id)` is accepted only from `bloqvia-core`, which
//!   forwards the learner's own `claim_bounty(id)` — the learner's scoped
//!   key keeps working and nobody can claim for someone else.
//! * A claim is recorded as `Pending` **before** any cross-contract call, so
//!   two claims in flight cannot pay twice. A failed transfer or a refused
//!   proposal removes the claim; the learner can try again later.
//! * Tiers: `Small` is paid by this contract at once from its allowance
//!   (reward capped at `small_cap`); `Medium` becomes a DAO Transfer proposal
//!   filed by this contract with the bond, paid by the DAO after a council
//!   vote; `Large` is only certified here (`Eligible`) and goes through the
//!   DAO's normal proposal flow.
//! * There is no method that changes a reward after a bounty is posted, no
//!   method that pays by hand, and this contract holds no key to the DAO.

use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap, Vector};
use near_sdk::{
    env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    Promise, PromiseError, PromiseOrValue,
};

// ----------------------------------------------------------------------
// Cross-contract interfaces
// ----------------------------------------------------------------------

/// The part of `bloqvia-core`'s `LearnerView` this contract reads. Unknown
/// fields are ignored, so core can grow without touching this crate.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct LearnerView {
    pub registered: bool,
    pub completed: Vec<String>,
    pub level: u8,
    pub graduated: bool,
}

#[ext_contract(ext_core)]
pub trait Core {
    fn get_learner(&self, account_id: AccountId) -> LearnerView;
}

/// Sputnik DAO v2: `add_proposal` takes `{ description, kind }` and returns
/// the proposal id. `Transfer` with `token_id: ""` moves NEAR.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub enum ProposalKind {
    Transfer { token_id: String, receiver_id: AccountId, amount: U128, msg: Option<String> },
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ProposalInput {
    pub description: String,
    pub kind: ProposalKind,
}

#[ext_contract(ext_dao)]
pub trait SputnikDao {
    fn add_proposal(&mut self, proposal: ProposalInput) -> u64;
}

#[ext_contract(ext_self)]
pub trait Callbacks {
    fn on_learner(&mut self, bounty_id: u64, claimer: AccountId, #[callback_result] learner: Result<LearnerView, PromiseError>) -> PromiseOrValue<ClaimStatus>;
    fn on_paid(&mut self, bounty_id: u64, claimer: AccountId, #[callback_result] result: Result<(), PromiseError>) -> ClaimStatus;
    fn on_proposed(&mut self, bounty_id: u64, claimer: AccountId, #[callback_result] result: Result<u64, PromiseError>) -> ClaimStatus;
}

const GAS_GET_LEARNER: Gas = Gas::from_tgas(10);
const GAS_ON_LEARNER: Gas = Gas::from_tgas(60);
const GAS_ADD_PROPOSAL: Gas = Gas::from_tgas(30);
const GAS_CALLBACK: Gas = Gas::from_tgas(10);

/// Kept back from the allowance so storage for new bounties and claims is
/// always covered (0.5 NEAR).
const STORAGE_RESERVE: NearToken = NearToken::from_millinear(500);
/// `get_recent_claims` returns at most this many records.
pub const RECENT_IN_VIEW: u32 = 20;

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier {
    Small,
    Medium,
    Large,
}

/// What the chain checks before a claim is honoured. All require `registered`.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Requirement {
    PassportLevel { min: u8 },
    QuestCompleted { lesson_id: String },
    Graduated,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ClaimStatus {
    /// Recorded before the cross-contract check; removed again on failure.
    Pending,
    /// Small tier: the board transferred the reward.
    Paid,
    /// Medium tier: the DAO proposal that pays on approval.
    Proposed { proposal_id: u64 },
    /// Large tier: qualified; the DAO's normal proposal flow pays.
    Eligible,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Claim {
    pub bounty_id: u64,
    pub account_id: AccountId,
    pub status: ClaimStatus,
    pub at_ns: u64,
}

/// Input for `add_bounty`; the contract assigns the id.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct BountyInput {
    pub title: String,
    pub description: String,
    pub tier: Tier,
    pub reward: NearToken,
    pub requirement: Requirement,
    pub max_claims: u32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Bounty {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub tier: Tier,
    pub reward: NearToken,
    pub requirement: Requirement,
    pub max_claims: u32,
    pub claims: u32,
    pub open: bool,
    pub created_by: AccountId,
    pub created_ns: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ConfigView {
    pub owner_id: AccountId,
    pub dao_id: AccountId,
    pub core_id: AccountId,
    pub small_cap: NearToken,
    pub proposal_bond: NearToken,
    /// What the board can still pay out for small bounties.
    pub allowance: NearToken,
    pub paid_total: NearToken,
    pub bounties_total: u64,
}

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Bounties,
    Claims,
    Recent,
}

fn claim_key(bounty_id: u64, account_id: &AccountId) -> String {
    format!("{bounty_id}:{account_id}")
}

fn emit(event: &str, data_json: String) {
    env::log_str(&format!(
        r#"EVENT_JSON:{{"standard":"bloqvia-bounties","version":"1.0.0","event":"{event}","data":[{data_json}]}}"#
    ));
}

// ----------------------------------------------------------------------
// Contract
// ----------------------------------------------------------------------

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    dao_id: AccountId,
    core_id: AccountId,
    small_cap: NearToken,
    proposal_bond: NearToken,
    bounties: IterableMap<u64, Bounty>,
    claims: LookupMap<String, Claim>,
    recent: Vector<Claim>,
    next_id: u64,
    paid_total: NearToken,
}

#[near]
impl Contract {
    /// `small_cap`: the largest reward the board pays by itself.
    /// `proposal_bond`: what the DAO's policy asks for `add_proposal`.
    #[init]
    pub fn new(owner_id: AccountId, dao_id: AccountId, core_id: AccountId, small_cap: NearToken, proposal_bond: NearToken) -> Self {
        require!(!small_cap.is_zero(), "small_cap must be positive");
        Self {
            owner_id,
            dao_id,
            core_id,
            small_cap,
            proposal_bond,
            bounties: IterableMap::new(StorageKey::Bounties),
            claims: LookupMap::new(StorageKey::Claims),
            recent: Vector::new(StorageKey::Recent),
            next_id: 1,
            paid_total: NearToken::from_yoctonear(0),
        }
    }

    // ------------------------------------------------------------------
    // Board management: the owner (setup) or the DAO (FunctionCall proposal)
    // ------------------------------------------------------------------

    pub fn add_bounty(&mut self, bounty: BountyInput) -> u64 {
        self.require_board();
        require!(!bounty.title.trim().is_empty() && bounty.title.len() <= 80, "title: 1-80 characters");
        require!(bounty.description.len() <= 1000, "description: at most 1000 characters");
        require!(!bounty.reward.is_zero(), "reward must be positive");
        require!(bounty.max_claims >= 1, "max_claims must be at least 1");
        if bounty.tier == Tier::Small {
            require!(bounty.reward <= self.small_cap, "Small tier reward is above small_cap");
        }
        let id = self.next_id;
        self.next_id += 1;
        let created_by = env::predecessor_account_id();
        let b = Bounty {
            id,
            title: bounty.title.trim().to_string(),
            description: bounty.description,
            tier: bounty.tier,
            reward: bounty.reward,
            requirement: bounty.requirement,
            max_claims: bounty.max_claims,
            claims: 0,
            open: true,
            created_by,
            created_ns: env::block_timestamp(),
        };
        emit("bounty_added", format!(r#"{{"id":{id},"tier":"{:?}","reward":"{}"}}"#, b.tier, b.reward.as_yoctonear()));
        self.bounties.insert(id, b);
        id
    }

    /// Stops new claims. Nothing else changes; paid and proposed claims stand.
    pub fn close_bounty(&mut self, bounty_id: u64) {
        self.require_board();
        let b = self.bounties.get_mut(&bounty_id).expect("No such bounty");
        b.open = false;
        emit("bounty_closed", format!(r#"{{"id":{bounty_id}}}"#));
    }

    /// Anyone may top up the allowance (the DAO does it with a Transfer
    /// proposal, which arrives as a plain transfer; this is for people).
    #[payable]
    pub fn fund(&mut self) {
        let amount = env::attached_deposit();
        require!(!amount.is_zero(), "Attach the NEAR to add");
        emit("funded", format!(r#"{{"from":"{}","amount":"{}"}}"#, env::predecessor_account_id(), amount.as_yoctonear()));
    }

    // ------------------------------------------------------------------
    // Claims: core forwards the learner's own call
    // ------------------------------------------------------------------

    /// Only `core` may call this, with the learner that called `claim_bounty`.
    pub fn claim_for(&mut self, account_id: AccountId, bounty_id: u64) -> Promise {
        require!(env::predecessor_account_id() == self.core_id, "Only core may claim for a learner");
        let b = self.bounties.get(&bounty_id).expect("No such bounty");
        require!(b.open, "Bounty closed");
        require!(b.claims < b.max_claims, "Bounty fully claimed");
        let key = claim_key(bounty_id, &account_id);
        require!(!self.claims.contains_key(&key), "Already claimed");
        self.claims.insert(
            key,
            Claim { bounty_id, account_id: account_id.clone(), status: ClaimStatus::Pending, at_ns: env::block_timestamp() },
        );
        ext_core::ext(self.core_id.clone())
            .with_static_gas(GAS_GET_LEARNER)
            .get_learner(account_id.clone())
            .then(ext_self::ext(env::current_account_id()).with_static_gas(GAS_ON_LEARNER).on_learner(bounty_id, account_id))
    }

    #[private]
    pub fn on_learner(
        &mut self,
        bounty_id: u64,
        claimer: AccountId,
        #[callback_result] learner: Result<LearnerView, PromiseError>,
    ) -> PromiseOrValue<ClaimStatus> {
        let b = self.bounties.get(&bounty_id).expect("No such bounty").clone();
        let learner = match learner {
            Ok(l) => l,
            Err(_) => return PromiseOrValue::Value(self.reject(bounty_id, &claimer, "Could not read the learner from core")),
        };
        if let Some(reason) = unmet(&b.requirement, &learner) {
            return PromiseOrValue::Value(self.reject(bounty_id, &claimer, reason));
        }
        match b.tier {
            Tier::Small => {
                if self.allowance() < b.reward {
                    return PromiseOrValue::Value(self.reject(bounty_id, &claimer, "Allowance empty: the DAO must fund the board"));
                }
                PromiseOrValue::Promise(
                    Promise::new(claimer.clone())
                        .transfer(b.reward)
                        .then(ext_self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_paid(bounty_id, claimer)),
                )
            }
            Tier::Medium => {
                if env::account_balance() < self.proposal_bond.saturating_add(STORAGE_RESERVE) {
                    return PromiseOrValue::Value(self.reject(bounty_id, &claimer, "The board cannot cover the proposal bond"));
                }
                let proposal = ProposalInput {
                    description: proposal_text(&b, &claimer),
                    kind: ProposalKind::Transfer { token_id: String::new(), receiver_id: claimer.clone(), amount: U128(b.reward.as_yoctonear()), msg: None },
                };
                PromiseOrValue::Promise(
                    ext_dao::ext(self.dao_id.clone())
                        .with_attached_deposit(self.proposal_bond)
                        .with_static_gas(GAS_ADD_PROPOSAL)
                        .add_proposal(proposal)
                        .then(ext_self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_proposed(bounty_id, claimer)),
                )
            }
            Tier::Large => PromiseOrValue::Value(self.settle(bounty_id, &claimer, ClaimStatus::Eligible)),
        }
    }

    #[private]
    pub fn on_paid(&mut self, bounty_id: u64, claimer: AccountId, #[callback_result] result: Result<(), PromiseError>) -> ClaimStatus {
        match result {
            Ok(()) => {
                let reward = self.bounties.get(&bounty_id).expect("No such bounty").reward;
                self.paid_total = self.paid_total.saturating_add(reward);
                self.settle(bounty_id, &claimer, ClaimStatus::Paid)
            }
            Err(_) => self.reject(bounty_id, &claimer, "Transfer failed"),
        }
    }

    #[private]
    pub fn on_proposed(&mut self, bounty_id: u64, claimer: AccountId, #[callback_result] result: Result<u64, PromiseError>) -> ClaimStatus {
        match result {
            Ok(proposal_id) => self.settle(bounty_id, &claimer, ClaimStatus::Proposed { proposal_id }),
            Err(_) => self.reject(bounty_id, &claimer, "The DAO refused the proposal (bond or permissions)"),
        }
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            owner_id: self.owner_id.clone(),
            dao_id: self.dao_id.clone(),
            core_id: self.core_id.clone(),
            small_cap: self.small_cap,
            proposal_bond: self.proposal_bond,
            allowance: self.allowance(),
            paid_total: self.paid_total,
            bounties_total: self.next_id - 1,
        }
    }

    pub fn get_bounty(&self, bounty_id: u64) -> Option<Bounty> {
        self.bounties.get(&bounty_id).cloned()
    }

    /// Newest first.
    pub fn get_bounties(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<Bounty> {
        let from = from_index.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(50).min(100) as usize;
        let mut all: Vec<Bounty> = self.bounties.values().cloned().collect();
        all.sort_by(|a, b| b.id.cmp(&a.id));
        all.into_iter().skip(from).take(limit).collect()
    }

    pub fn get_claim(&self, bounty_id: u64, account_id: AccountId) -> Option<Claim> {
        self.claims.get(&claim_key(bounty_id, &account_id)).cloned()
    }

    /// Every claim this account holds, newest bounty first.
    pub fn get_claims_for(&self, account_id: AccountId) -> Vec<Claim> {
        let mut out: Vec<Claim> = self
            .bounties
            .keys()
            .filter_map(|id| self.claims.get(&claim_key(*id, &account_id)).cloned())
            .collect();
        out.sort_by(|a, b| b.bounty_id.cmp(&a.bounty_id));
        out
    }

    /// The last settled claims (paid, proposed, eligible), newest first.
    pub fn get_recent_claims(&self, limit: Option<u32>) -> Vec<Claim> {
        let limit = limit.unwrap_or(RECENT_IN_VIEW).min(RECENT_IN_VIEW) as usize;
        let len = self.recent.len() as usize;
        (0..len.min(limit)).filter_map(|i| self.recent.get((len - 1 - i) as u32).cloned()).collect()
    }

    /// The exact text a Large-tier claimant files in the DAO.
    pub fn get_proposal_text(&self, bounty_id: u64, account_id: AccountId) -> String {
        let b = self.bounties.get(&bounty_id).expect("No such bounty");
        proposal_text(b, &account_id)
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    fn require_board(&self) {
        let caller = env::predecessor_account_id();
        require!(caller == self.owner_id || caller == self.dao_id, "Only the owner or the DAO may manage bounties");
    }

    /// Balance minus the bond the next medium claim needs and a storage reserve.
    fn allowance(&self) -> NearToken {
        let locked = env::storage_byte_cost()
            .saturating_mul(env::storage_usage() as u128)
            .saturating_add(STORAGE_RESERVE)
            .saturating_add(self.proposal_bond);
        env::account_balance().checked_sub(locked).unwrap_or(NearToken::from_yoctonear(0))
    }

    fn settle(&mut self, bounty_id: u64, claimer: &AccountId, status: ClaimStatus) -> ClaimStatus {
        let key = claim_key(bounty_id, claimer);
        let claim = self.claims.get_mut(&key).expect("No pending claim");
        claim.status = status.clone();
        let record = claim.clone();
        let b = self.bounties.get_mut(&bounty_id).expect("No such bounty");
        b.claims += 1;
        let (event, extra) = match &status {
            ClaimStatus::Paid => ("claim_paid", format!(r#","amount":"{}""#, b.reward.as_yoctonear())),
            ClaimStatus::Proposed { proposal_id } => ("claim_proposed", format!(r#","proposal_id":{proposal_id}"#)),
            ClaimStatus::Eligible => ("claim_eligible", String::new()),
            ClaimStatus::Pending => ("claim_pending", String::new()),
        };
        emit(event, format!(r#"{{"id":{bounty_id},"account_id":"{claimer}"{extra}}}"#));
        self.recent.push(record);
        status
    }

    fn reject(&mut self, bounty_id: u64, claimer: &AccountId, reason: &str) -> ClaimStatus {
        self.claims.remove(&claim_key(bounty_id, claimer));
        emit("claim_rejected", format!(r#"{{"id":{bounty_id},"account_id":"{claimer}","reason":"{reason}"}}"#));
        env::log_str(&format!("claim rejected: {reason}"));
        ClaimStatus::Pending
    }
}

/// `None` when the learner meets the requirement, else the reason shown to them.
pub fn unmet(req: &Requirement, l: &LearnerView) -> Option<&'static str> {
    if !l.registered {
        return Some("Not a registered learner");
    }
    match req {
        Requirement::PassportLevel { min } => (l.level < *min).then_some("Passport level too low"),
        Requirement::QuestCompleted { lesson_id } => (!l.completed.iter().any(|c| c == lesson_id)).then_some("Quest not completed"),
        Requirement::Graduated => (!l.graduated).then_some("Not graduated yet"),
    }
}

fn proposal_text(b: &Bounty, claimer: &AccountId) -> String {
    format!(
        "Bloqvia bounty #{} \"{}\" ({:?}): {} qualified on chain ({}). Pay {}.",
        b.id,
        b.title,
        b.tier,
        claimer,
        match &b.requirement {
            Requirement::PassportLevel { min } => format!("Passport level >= {min}"),
            Requirement::QuestCompleted { lesson_id } => format!("completed {lesson_id}"),
            Requirement::Graduated => "graduated".to_string(),
        },
        b.reward.exact_amount_display()
    )
}

// ----------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, get_logs, VMContextBuilder};
    use near_sdk::testing_env;

    fn owner() -> AccountId {
        accounts(0)
    }
    fn dao() -> AccountId {
        accounts(1)
    }
    fn core() -> AccountId {
        accounts(2)
    }
    fn alice() -> AccountId {
        accounts(3)
    }
    fn board() -> AccountId {
        "bounties.bloqvia.testnet".parse().unwrap()
    }

    fn ctx(caller: AccountId, balance: NearToken) {
        let mut c = VMContextBuilder::new();
        c.current_account_id(board())
            .signer_account_id(caller.clone())
            .predecessor_account_id(caller)
            .account_balance(balance)
            .block_timestamp(1_000);
        testing_env!(c.build());
    }
    const TEN: NearToken = NearToken::from_near(10);

    fn deployed() -> Contract {
        ctx(owner(), TEN);
        Contract::new(owner(), dao(), core(), NearToken::from_millinear(500), NearToken::from_millinear(100))
    }

    fn input(tier: Tier, reward: NearToken, req: Requirement) -> BountyInput {
        BountyInput { title: "Explain gas".into(), description: "Three lines for a newcomer".into(), tier, reward, requirement: req, max_claims: 2 }
    }

    fn learner(level: u8, completed: &[&str], graduated: bool) -> LearnerView {
        LearnerView { registered: true, completed: completed.iter().map(|s| s.to_string()).collect(), level, graduated }
    }

    #[test]
    fn owner_and_dao_post_bounties_nobody_else() {
        let mut c = deployed();
        let id = c.add_bounty(input(Tier::Small, NearToken::from_millinear(100), Requirement::PassportLevel { min: 1 }));
        assert_eq!(id, 1);
        ctx(dao(), TEN);
        assert_eq!(c.add_bounty(input(Tier::Large, NearToken::from_near(5), Requirement::Graduated)), 2);
        assert_eq!(c.get_bounties(None, None)[0].id, 2, "newest first");
        assert_eq!(c.get_config().bounties_total, 2);
    }

    #[test]
    #[should_panic(expected = "Only the owner or the DAO")]
    fn a_learner_cannot_post() {
        let mut c = deployed();
        ctx(alice(), TEN);
        c.add_bounty(input(Tier::Small, NearToken::from_millinear(100), Requirement::Graduated));
    }

    #[test]
    #[should_panic(expected = "above small_cap")]
    fn small_tier_is_capped() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Small, NearToken::from_near(1), Requirement::Graduated));
    }

    #[test]
    #[should_panic(expected = "Only core may claim")]
    fn only_core_forwards_claims() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Small, NearToken::from_millinear(100), Requirement::Graduated));
        ctx(alice(), TEN);
        let _ = c.claim_for(alice(), 1);
    }

    #[test]
    fn small_claim_pays_once_and_records_it() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Small, NearToken::from_millinear(100), Requirement::QuestCompleted { lesson_id: "daily-2026-11-05".into() }));
        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        assert_eq!(c.get_claim(1, alice()).unwrap().status, ClaimStatus::Pending);

        ctx(board(), TEN);
        let out = c.on_learner(1, alice(), Ok(learner(0, &["daily-2026-11-05"], false)));
        assert!(matches!(out, PromiseOrValue::Promise(_)), "small tier transfers");
        assert_eq!(c.on_paid(1, alice(), Ok(())), ClaimStatus::Paid);
        assert_eq!(c.get_claim(1, alice()).unwrap().status, ClaimStatus::Paid);
        assert_eq!(c.get_bounty(1).unwrap().claims, 1);
        assert_eq!(c.get_config().paid_total, NearToken::from_millinear(100));
        assert_eq!(c.get_recent_claims(None).len(), 1);
        assert!(get_logs().iter().any(|l| l.contains("claim_paid")));

        ctx(core(), TEN);
        let again = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.claim_for(alice(), 1)));
        assert!(again.is_err(), "one claim per account per bounty");
    }

    #[test]
    fn unmet_requirement_removes_the_claim_so_they_can_retry() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Small, NearToken::from_millinear(100), Requirement::PassportLevel { min: 3 }));
        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        ctx(board(), TEN);
        let out = c.on_learner(1, alice(), Ok(learner(2, &[], false)));
        assert!(matches!(out, PromiseOrValue::Value(ClaimStatus::Pending)));
        assert!(c.get_claim(1, alice()).is_none());
        assert_eq!(c.get_bounty(1).unwrap().claims, 0);
        assert!(get_logs().iter().any(|l| l.contains("Passport level too low")));
        // Later, at level 3, the same learner claims again.
        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        ctx(board(), TEN);
        assert!(matches!(c.on_learner(1, alice(), Ok(learner(3, &[], false))), PromiseOrValue::Promise(_)));
    }

    #[test]
    fn failed_transfer_or_core_error_frees_the_claim() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Small, NearToken::from_millinear(100), Requirement::Graduated));
        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        ctx(board(), TEN);
        let _ = c.on_learner(1, alice(), Err(PromiseError::Failed));
        assert!(c.get_claim(1, alice()).is_none());

        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        ctx(board(), TEN);
        let _ = c.on_learner(1, alice(), Ok(learner(3, &[], true)));
        assert_eq!(c.on_paid(1, alice(), Err(PromiseError::Failed)), ClaimStatus::Pending);
        assert!(c.get_claim(1, alice()).is_none());
        assert_eq!(c.get_config().paid_total, NearToken::from_yoctonear(0));
    }

    #[test]
    fn empty_allowance_rejects_small_claims() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Small, NearToken::from_millinear(400), Requirement::Graduated));
        ctx(core(), NearToken::from_millinear(700));
        let _ = c.claim_for(alice(), 1);
        // 0.7 NEAR minus storage reserve (0.5) minus bond (0.1) minus storage < 0.4 reward.
        ctx(board(), NearToken::from_millinear(700));
        let out = c.on_learner(1, alice(), Ok(learner(3, &[], true)));
        assert!(matches!(out, PromiseOrValue::Value(ClaimStatus::Pending)));
        assert!(get_logs().iter().any(|l| l.contains("Allowance empty")));
        assert!(c.get_config().allowance < NearToken::from_millinear(400));
    }

    #[test]
    fn medium_claim_becomes_a_dao_proposal() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Medium, NearToken::from_near(2), Requirement::Graduated));
        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        ctx(board(), TEN);
        assert!(matches!(c.on_learner(1, alice(), Ok(learner(3, &[], true))), PromiseOrValue::Promise(_)));
        assert_eq!(c.on_proposed(1, alice(), Ok(7)), ClaimStatus::Proposed { proposal_id: 7 });
        assert_eq!(c.get_claim(1, alice()).unwrap().status, ClaimStatus::Proposed { proposal_id: 7 });
        assert!(get_logs().iter().any(|l| l.contains(r#""proposal_id":7"#)));
        let text = c.get_proposal_text(1, alice());
        assert!(text.contains("#1") && text.contains("graduated") && text.contains("2 NEAR"), "{text}");
    }

    #[test]
    fn refused_proposal_frees_the_claim() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Medium, NearToken::from_near(2), Requirement::Graduated));
        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        ctx(board(), TEN);
        let _ = c.on_learner(1, alice(), Ok(learner(3, &[], true)));
        assert_eq!(c.on_proposed(1, alice(), Err(PromiseError::Failed)), ClaimStatus::Pending);
        assert!(c.get_claim(1, alice()).is_none());
    }

    #[test]
    fn large_claim_is_certified_only() {
        let mut c = deployed();
        c.add_bounty(input(Tier::Large, NearToken::from_near(20), Requirement::Graduated));
        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        ctx(board(), TEN);
        assert!(matches!(c.on_learner(1, alice(), Ok(learner(3, &[], true))), PromiseOrValue::Value(ClaimStatus::Eligible)));
        assert_eq!(c.get_claims_for(alice())[0].status, ClaimStatus::Eligible);
        assert_eq!(c.get_config().paid_total, NearToken::from_yoctonear(0), "the board paid nothing");
    }

    #[test]
    fn closed_and_full_bounties_take_no_claims() {
        let mut c = deployed();
        c.add_bounty(BountyInput { max_claims: 1, ..input(Tier::Large, NearToken::from_near(1), Requirement::Graduated) });
        c.add_bounty(input(Tier::Large, NearToken::from_near(1), Requirement::Graduated));
        ctx(core(), TEN);
        let _ = c.claim_for(alice(), 1);
        ctx(board(), TEN);
        let _ = c.on_learner(1, alice(), Ok(learner(3, &[], true)));
        ctx(core(), TEN);
        let full = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.claim_for(accounts(4), 1)));
        assert!(full.is_err(), "max_claims reached");

        ctx(owner(), TEN);
        c.close_bounty(2);
        ctx(core(), TEN);
        let closed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.claim_for(alice(), 2)));
        assert!(closed.is_err(), "closed bounty");
        assert!(!c.get_bounty(2).unwrap().open);
    }

    #[test]
    fn json_shapes_match_the_deploy_script_and_sputnik() {
        use near_sdk::serde_json;
        let seed = r#"{"title":"Teach one newcomer","description":"…","tier":"Medium","reward":"1000000000000000000000000","requirement":{"PassportLevel":{"min":3}},"max_claims":5}"#;
        let b: BountyInput = serde_json::from_str(seed).unwrap();
        assert_eq!(b.reward, NearToken::from_near(1));
        assert_eq!(b.requirement, Requirement::PassportLevel { min: 3 });
        let unit: BountyInput = serde_json::from_str(&seed.replace(r#"{"PassportLevel":{"min":3}}"#, r#""Graduated""#)).unwrap();
        assert_eq!(unit.requirement, Requirement::Graduated);
        // Sputnik v2 reads {"description","kind":{"Transfer":{"token_id":"","receiver_id","amount","msg"}}}.
        let p = ProposalInput { description: "x".into(), kind: ProposalKind::Transfer { token_id: String::new(), receiver_id: alice(), amount: U128(5), msg: None } };
        assert_eq!(serde_json::to_string(&p).unwrap(), r#"{"description":"x","kind":{"Transfer":{"token_id":"","receiver_id":"danny","amount":"5","msg":null}}}"#);
        // core's LearnerView carries more fields than this crate reads.
        let l: LearnerView = serde_json::from_str(r#"{"account_id":"a","registered":true,"completed":["x"],"level":2,"graduated":false,"gold":"10","items":[["key-fragment","1"]]}"#).unwrap();
        assert_eq!(l.level, 2);
    }

    #[test]
    fn requirements_read_like_the_board_says() {
        assert_eq!(unmet(&Requirement::Graduated, &learner(3, &[], false)), Some("Not graduated yet"));
        assert_eq!(unmet(&Requirement::QuestCompleted { lesson_id: "x".into() }, &learner(0, &["x"], false)), None);
        let mut l = learner(3, &[], true);
        l.registered = false;
        assert_eq!(unmet(&Requirement::Graduated, &l), Some("Not a registered learner"));
    }
}
