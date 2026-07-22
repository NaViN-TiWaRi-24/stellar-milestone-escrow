#![cfg(test)]

use super::{
    MilestoneEscrowContract, MilestoneEscrowContractClient, MilestoneInput, MilestoneStatus,
    ProjectStatus,
};
use soroban_sdk::{testutils::Address as _, vec, Address, Env, String};

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
