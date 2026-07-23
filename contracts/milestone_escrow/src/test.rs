#![cfg(test)]

use super::{
    MilestoneEscrowContract, MilestoneEscrowContractClient, MilestoneInput, MilestoneStatus,
    ProjectStatus,
};
use soroban_sdk::{testutils::Address as _, token, vec, Address, Env, String};

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MilestoneEscrowContract, ());
    let client = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let asset = Address::generate(&env);

    (env, contract_id, client, freelancer, asset)
}

fn sample_milestones(env: &Env) -> soroban_sdk::Vec<MilestoneInput> {
    vec![
        env,
        MilestoneInput {
            title: String::from_str(env, "Design"),
            amount: 400,
            deadline: 100,
        },
        MilestoneInput {
            title: String::from_str(env, "Development"),
            amount: 600,
            deadline: 200,
        },
    ]
}

#[test]
fn create_and_get_project() {
    let (env, contract_id, client_address, freelancer, asset) = setup();
    let contract = MilestoneEscrowContractClient::new(&env, &contract_id);
    let milestones = sample_milestones(&env);

    let project_id = contract.create_project(
        &client_address,
        &freelancer,
        &asset,
        &String::from_str(&env, "Website Project"),
        &1_000,
        &milestones,
    );

    let project = contract.get_project(&project_id);

    assert_eq!(project_id, 1);
    assert_eq!(project.id, 1);
    assert_eq!(project.client, client_address);
    assert_eq!(project.freelancer, freelancer);
    assert_eq!(project.asset, asset);
    assert_eq!(project.total_amount, 1_000);
    assert_eq!(project.escrowed_amount, 0);
    assert_eq!(project.released_amount, 0);
    assert_eq!(project.status, ProjectStatus::Created);
    assert_eq!(project.milestones.len(), 2);

    let first_milestone = project.milestones.get(0).unwrap();
    assert_eq!(first_milestone.id, 0);
    assert_eq!(first_milestone.amount, 400);
    assert_eq!(first_milestone.status, MilestoneStatus::Pending);
}

#[test]
fn project_ids_increase() {
    let (env, contract_id, client_address, freelancer, asset) = setup();
    let contract = MilestoneEscrowContractClient::new(&env, &contract_id);
    let milestones = sample_milestones(&env);
    let title = String::from_str(&env, "Website Project");

    let first_id = contract.create_project(
        &client_address,
        &freelancer,
        &asset,
        &title,
        &1_000,
        &milestones,
    );

    let second_id = contract.create_project(
        &client_address,
        &freelancer,
        &asset,
        &title,
        &1_000,
        &milestones,
    );

    assert_eq!(first_id, 1);
    assert_eq!(second_id, 2);
}

#[test]
fn freelancer_accepts_project() {
    let (env, contract_id, client_address, freelancer, asset) = setup();
    let contract = MilestoneEscrowContractClient::new(&env, &contract_id);
    let milestones = sample_milestones(&env);

    let project_id = contract.create_project(
        &client_address,
        &freelancer,
        &asset,
        &String::from_str(&env, "Website Project"),
        &1_000,
        &milestones,
    );

    let accepted_project = contract.accept_project(&project_id, &freelancer);

    assert_eq!(accepted_project.status, ProjectStatus::Accepted);

    let stored_project = contract.get_project(&project_id);
    assert_eq!(stored_project.status, ProjectStatus::Accepted);
}

#[test]
fn client_funds_project_with_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MilestoneEscrowContract, ());
    let client_address = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let asset = token_contract.address();

    let token_admin_client = token::StellarAssetClient::new(&env, &asset);
    let token_client = token::Client::new(&env, &asset);
    token_admin_client.mint(&client_address, &2_000);

    let contract = MilestoneEscrowContractClient::new(&env, &contract_id);
    let milestones = sample_milestones(&env);

    let project_id = contract.create_project(
        &client_address,
        &freelancer,
        &asset,
        &String::from_str(&env, "Website Project"),
        &1_000,
        &milestones,
    );

    contract.accept_project(&project_id, &freelancer);
    let funded_project = contract.fund_project(&project_id, &client_address);

    assert_eq!(funded_project.status, ProjectStatus::Funded);
    assert_eq!(funded_project.escrowed_amount, 1_000);
    assert_eq!(token_client.balance(&client_address), 1_000);
    assert_eq!(token_client.balance(&contract_id), 1_000);
}

#[test]
fn freelancer_submits_milestone_work() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MilestoneEscrowContract, ());
    let client_address = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let asset = token_contract.address();

    let token_admin_client = token::StellarAssetClient::new(&env, &asset);
    token_admin_client.mint(&client_address, &1_000);

    let contract = MilestoneEscrowContractClient::new(&env, &contract_id);
    let milestones = sample_milestones(&env);

    let project_id = contract.create_project(
        &client_address,
        &freelancer,
        &asset,
        &String::from_str(&env, "Website Project"),
        &1_000,
        &milestones,
    );

    contract.accept_project(&project_id, &freelancer);
    contract.fund_project(&project_id, &client_address);

    let work_reference = String::from_str(&env, "https://example.com/design");
    let updated_project = contract.submit_milestone(&project_id, &0, &freelancer, &work_reference);

    assert_eq!(updated_project.status, ProjectStatus::Active);

    let submitted_milestone = updated_project.milestones.get(0).unwrap();
    assert_eq!(submitted_milestone.status, MilestoneStatus::Submitted);
    assert_eq!(submitted_milestone.work_reference, work_reference);
}

#[test]
fn client_approves_submitted_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MilestoneEscrowContract, ());
    let client_address = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let asset = token_contract.address();

    let token_admin_client = token::StellarAssetClient::new(&env, &asset);
    token_admin_client.mint(&client_address, &1_000);

    let contract = MilestoneEscrowContractClient::new(&env, &contract_id);
    let milestones = sample_milestones(&env);

    let project_id = contract.create_project(
        &client_address,
        &freelancer,
        &asset,
        &String::from_str(&env, "Website Project"),
        &1_000,
        &milestones,
    );

    contract.accept_project(&project_id, &freelancer);
    contract.fund_project(&project_id, &client_address);

    contract.submit_milestone(
        &project_id,
        &0,
        &freelancer,
        &String::from_str(&env, "https://example.com/design"),
    );

    let approved_project = contract.approve_milestone(&project_id, &0, &client_address);

    let approved_milestone = approved_project.milestones.get(0).unwrap();
    assert_eq!(approved_milestone.status, MilestoneStatus::Approved);

    let stored_project = contract.get_project(&project_id);
    assert_eq!(
        stored_project.milestones.get(0).unwrap().status,
        MilestoneStatus::Approved
    );
}
#[test]
fn approved_milestone_payment_is_released_to_freelancer() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MilestoneEscrowContract, ());
    let client_address = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin);
    let asset = token_contract.address();

    let token_admin_client = token::StellarAssetClient::new(&env, &asset);
    let token_client = token::Client::new(&env, &asset);
    token_admin_client.mint(&client_address, &1_000);

    let contract = MilestoneEscrowContractClient::new(&env, &contract_id);
    let milestones = sample_milestones(&env);

    let project_id = contract.create_project(
        &client_address,
        &freelancer,
        &asset,
        &String::from_str(&env, "Website Project"),
        &1_000,
        &milestones,
    );

    contract.accept_project(&project_id, &freelancer);
    contract.fund_project(&project_id, &client_address);

    contract.submit_milestone(
        &project_id,
        &0,
        &freelancer,
        &String::from_str(&env, "https://example.com/design"),
    );

    contract.approve_milestone(&project_id, &0, &client_address);

    let updated_project = contract.release_milestone_payment(&project_id, &0, &client_address);

    assert_eq!(updated_project.released_amount, 400);
    assert_eq!(updated_project.status, ProjectStatus::Active);
    assert_eq!(
        updated_project.milestones.get(0).unwrap().status,
        MilestoneStatus::Paid
    );

    assert_eq!(token_client.balance(&freelancer), 400);
    assert_eq!(token_client.balance(&contract_id), 600);
}
