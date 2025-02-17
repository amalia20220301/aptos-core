// Copyright (c) Aptos
// SPDX-License-Identifier: Apache-2.0

import {
  AptosAccount, AptosClient, MaybeHexString, Types,
} from 'aptos';
import {
  type GetAptosCoinTokenBalanceFromAccountResourcesProps,
} from 'core/queries/account';
// import {DefaultKeyring} from "@keystonehq/aptos-keyring";
import { DefaultKeyring } from '@keystonehq/aptos-keyring';

export interface SubmitTransactionProps {
  fromAccount: AptosAccount;
  nodeUrl: string;
  payload: Types.TransactionPayload,
}

export const submitTransaction = async ({
  fromAccount,
  nodeUrl,
  payload,
}: SubmitTransactionProps) => {
  const client = new AptosClient('https://fullnode.devnet.aptoslabs.com/');
  console.log('-----submitTransaction----------', payload, nodeUrl);
  const txnRequest = await client.generateTransaction(fromAccount.address(), payload);
  const keyring = await DefaultKeyring.getEmptyKeyring();
  const message = await client.createSigningMessage(txnRequest);
  const aptosSignature = await keyring.signMessage('0x1381b072958038a07577b0b4700f87d320e70fde469181cee471c6510bdcd196', Buffer.from(message, 'hex'), fromAccount.address().hex());
  const transactionSignature: Types.TransactionSignature = {
    public_key: aptosSignature.getAuthenticationPublicKey().toString('hex'),
    signature: aptosSignature.getSignature().toString('hex'),
    type: 'ed25519_signature',
  };
  const signedTxn = { signature: transactionSignature, ...txnRequest };
  const transactionRes = await client.submitTransaction(signedTxn);
  await client.waitForTransaction(transactionRes.hash);
  return transactionRes.hash;
};

export interface AptosCoinTransferTransactionPayload {
  amount: string | number;
  toAddress: MaybeHexString;
}

export type SendAptosCoinTransactionProps = Omit<SubmitTransactionProps & AptosCoinTransferTransactionPayload, 'payload'>;

export const sendAptosCoinTransaction = async ({
  amount,
  fromAccount,
  nodeUrl,
  toAddress,
}: SendAptosCoinTransactionProps) => {
  const payload: Types.TransactionPayload = {
    arguments: [toAddress, `${amount}`],
    function: '0x1::coin::transfer',
    type: 'entry_function_payload',
    type_arguments: ['0x1::aptos_coin::AptosCoin'],
  };
  const txnHash = await submitTransaction({
    fromAccount,
    nodeUrl,
    payload,
  });
  return txnHash;
};

export const TransferResult = Object.freeze({
  AmountOverLimit: 'Amount is over limit',
  AmountWithGasOverLimit: 'Amount with gas is over limit',
  IncorrectPayload: 'Incorrect transaction payload',
  Success: 'Transaction executed successfully',
  UndefinedAccount: 'Account does not exist',
} as const);

export type SubmitAptosCoinTransferTransactionProps = Omit<
AptosCoinTransferTransactionPayload &
SendAptosCoinTransactionProps &
GetAptosCoinTokenBalanceFromAccountResourcesProps & {
  onClose: () => void
},
'accountResources'
>;

export const submitAptosCoinTransferTransaction = async ({
  amount,
  fromAccount,
  nodeUrl,
  onClose,
  toAddress,
}: SubmitAptosCoinTransferTransactionProps) => {
  const txnHash = await sendAptosCoinTransaction({
    amount,
    fromAccount,
    nodeUrl,
    toAddress,
  });
  onClose();
  return txnHash;
};
