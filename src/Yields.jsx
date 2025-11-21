import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, DollarSign, Zap, AlertCircle, CheckCircle, Target, BarChart3, Percent, RefreshCw, Layers, ArrowRight, Clock, Award, Wallet } from 'lucide-react';
import { ethers } from 'ethers';
import $u from './utils/$u.js';
import ERC20 from './contracts/abizar.json';
import Pendle_PT_25_SEP from './contracts/PT-25Sep.json';
import Morpho_ABI from './contracts/Morpho.json';
import Morpho_IRM from './contracts/Morpho_IRM.json';
import Ethena_SUSDE from './contracts/Ethena_stackedusde.json';
import Ethena_USDE from './contracts/Ethena_usde.json';
import axios from 'axios';


const CONTRACT_ADDRESS1 = "0x97637d50523514510587D2AEBC3dc13F00D4E74b";// "0x90192eC1D27EbCe415EB49AC4DB391A2C64134B4"; // arb sep
const TOKEN_ADDRESS1 = "0x900186aa7B0CbDe4C43AeE8Db110d51b68DEe3B1"; //"0xe699d95FA81E03078e68a89a9774bbf5F35D9121"; // arb sep

const CONTRACT_ADDRESS = "0xF8564E2C94633a714c2f0B8AA66E13C4c7c0cE98"; //"0x59c863E77791eEe6746E24E183cf026a1A6C94B9";//"0x7B8eFa883755Dd042D8e365432BA6238489BC69c";
const TOKEN_ADDRESS = "0x900186aa7B0CbDe4C43AeE8Db110d51b68DEe3B1";

            