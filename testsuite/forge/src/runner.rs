// Copyright (c) Aptos
// SPDX-License-Identifier: Apache-2.0

use crate::*;
use rand::{Rng, SeedableRng};
use std::fmt::{Display, Formatter};
use std::time::Duration;
use std::{
    io::{self, Write},
    num::NonZeroUsize,
    process,
};
use structopt::{clap::arg_enum, StructOpt};
use termcolor::{Color, ColorChoice, ColorSpec, StandardStream, WriteColor};
use tokio::runtime::Runtime;
// TODO going to remove random seed once cluster deployment supports re-run genesis
use crate::success_criteria::SuccessCriteria;
use framework::ReleaseBundle;
use rand::rngs::OsRng;

#[derive(Debug, StructOpt)]
#[structopt(about = "Forged in Fire")]
pub struct Options {
    /// The FILTER string is tested against the name of all tests, and only those tests whose names
    /// contain the filter are run.
    filter: Option<String>,
    #[structopt(long = "exact")]
    /// Exactly match filters rather than by substring
    filter_exact: bool,
    #[allow(dead_code)]
    #[structopt(long, default_value = "1", env = "RUST_TEST_THREADS")]
    /// NO-OP: unsupported option, exists for compatibility with the default test harness
    /// Number of threads used for running tests in parallel
    test_threads: NonZeroUsize,
    #[allow(dead_code)]
    #[structopt(short = "q", long)]
    /// NO-OP: unsupported option, exists for compatibility with the default test harness
    quiet: bool,
    #[allow(dead_code)]
    #[structopt(long)]
    /// NO-OP: unsupported option, exists for compatibility with the default test harness
    nocapture: bool,
    #[structopt(long)]
    /// List all tests
    pub list: bool,
    #[structopt(long)]
    /// List or run ignored tests
    ignored: bool,
    #[structopt(long)]
    /// Include ignored tests when listing or running tests
    include_ignored: bool,
    /// Configure formatting of output:
    ///   pretty = Print verbose output;
    ///   terse = Display one character per test;
    ///   (json is unsupported, exists for compatibility with the default test harness)
    #[structopt(long, possible_values = &Format::variants(), default_value, case_insensitive = true)]
    format: Format,
    #[allow(dead_code)]
    #[structopt(short = "Z")]
    /// NO-OP: unsupported option, exists for compatibility with the default test harness
    /// -Z unstable-options Enable nightly-only flags:
    ///                     unstable-options = Allow use of experimental features
    z_unstable_options: Option<String>,
    #[allow(dead_code)]
    #[structopt(long)]
    /// NO-OP: unsupported option, exists for compatibility with the default test harness
    /// Show captured stdout of successful tests
    show_output: bool,
}

impl Options {
    pub fn from_args() -> Self {
        StructOpt::from_args()
    }
}

arg_enum! {
    #[derive(Debug, Eq, PartialEq)]
    pub enum Format {
        Pretty,
        Terse,
        Json,
    }
}

impl Default for Format {
    fn default() -> Self {
        Format::Pretty
    }
}

pub fn forge_main<F: Factory>(tests: ForgeConfig<'_>, factory: F, options: &Options) -> Result<()> {
    let forge = Forge::new(
        options,
        tests,
        factory,
        EmitJobRequest::default(),
        SuccessCriteria::default(),
    );

    if options.list {
        forge.list()?;

        return Ok(());
    }

    match forge.run() {
        Ok(..) => Ok(()),
        Err(e) => {
            eprintln!("Failed to run tests:\n{}", e);
            process::exit(101); // Exit with a non-zero exit code if tests failed
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum InitialVersion {
    Oldest,
    Newest,
}

pub struct ForgeConfig<'cfg> {
    aptos_tests: &'cfg [&'cfg dyn AptosTest],
    admin_tests: &'cfg [&'cfg dyn AdminTest],
    network_tests: &'cfg [&'cfg dyn NetworkTest],

    /// The initial number of validators to spawn when the test harness creates a swarm
    initial_validator_count: NonZeroUsize,

    /// The initial number of fullnodes to spawn when the test harness creates a swarm
    initial_fullnode_count: usize,

    /// The initial version to use when the test harness creates a swarm
    initial_version: InitialVersion,

    /// The initial genesis modules to use when starting a network
    genesis_config: Option<GenesisConfig>,
}

impl<'cfg> ForgeConfig<'cfg> {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_aptos_tests(mut self, aptos_tests: &'cfg [&'cfg dyn AptosTest]) -> Self {
        self.aptos_tests = aptos_tests;
        self
    }

    pub fn with_admin_tests(mut self, admin_tests: &'cfg [&'cfg dyn AdminTest]) -> Self {
        self.admin_tests = admin_tests;
        self
    }

    pub fn with_network_tests(mut self, network_tests: &'cfg [&'cfg dyn NetworkTest]) -> Self {
        self.network_tests = network_tests;
        self
    }

    pub fn with_initial_validator_count(mut self, initial_validator_count: NonZeroUsize) -> Self {
        self.initial_validator_count = initial_validator_count;
        self
    }

    pub fn with_initial_fullnode_count(mut self, initial_fullnode_count: usize) -> Self {
        self.initial_fullnode_count = initial_fullnode_count;
        self
    }

    pub fn with_initial_version(mut self, initial_version: InitialVersion) -> Self {
        self.initial_version = initial_version;
        self
    }

    pub fn with_genesis_module_bundle(mut self, bundle: ReleaseBundle) -> Self {
        self.genesis_config = Some(GenesisConfig::Bundle(bundle));
        self
    }

    pub fn with_genesis_modules_path(mut self, genesis_modules: String) -> Self {
        self.genesis_config = Some(GenesisConfig::Path(genesis_modules));
        self
    }

    pub fn number_of_tests(&self) -> usize {
        self.admin_tests.len() + self.network_tests.len() + self.aptos_tests.len()
    }

    pub fn all_tests(&self) -> impl Iterator<Item = &'cfg dyn Test> + 'cfg {
        self.admin_tests
            .iter()
            .map(|t| t as &dyn Test)
            .chain(self.network_tests.iter().map(|t| t as &dyn Test))
            .chain(self.aptos_tests.iter().map(|t| t as &dyn Test))
    }
}

impl<'cfg> Default for ForgeConfig<'cfg> {
    fn default() -> Self {
        Self {
            aptos_tests: &[],
            admin_tests: &[],
            network_tests: &[],
            initial_validator_count: NonZeroUsize::new(1).unwrap(),
            initial_fullnode_count: 0,
            initial_version: InitialVersion::Oldest,
            genesis_config: None,
        }
    }
}

pub struct Forge<'cfg, F> {
    options: &'cfg Options,
    tests: ForgeConfig<'cfg>,
    factory: F,
    global_job_request: EmitJobRequest,
    success_criteria: SuccessCriteria,
}

impl<'cfg, F: Factory> Forge<'cfg, F> {
    pub fn new(
        options: &'cfg Options,
        tests: ForgeConfig<'cfg>,
        factory: F,
        global_job_request: EmitJobRequest,
        success_criteria: SuccessCriteria,
    ) -> Self {
        Self {
            options,
            tests,
            factory,
            global_job_request,
            success_criteria,
        }
    }

    pub fn list(&self) -> Result<()> {
        for test in self.filter_tests(self.tests.all_tests()) {
            println!("{}: test", test.name());
        }

        if self.options.format == Format::Pretty {
            println!();
            println!(
                "{} tests",
                self.filter_tests(self.tests.all_tests()).count()
            );
        }

        Ok(())
    }

    pub fn initial_version(&self) -> Version {
        let versions = self.factory.versions();
        match self.tests.initial_version {
            InitialVersion::Oldest => versions.min(),
            InitialVersion::Newest => versions.max(),
        }
        .expect("There has to be at least 1 version")
    }

    pub fn genesis_version(&self) -> Version {
        self.factory
            .versions()
            .max()
            .expect("There has to be at least 1 version")
    }

    pub fn run(&self) -> Result<TestReport> {
        let test_count = self.filter_tests(self.tests.all_tests()).count();
        let filtered_out = test_count.saturating_sub(self.tests.all_tests().count());

        let mut report = TestReport::new();
        let mut summary = TestSummary::new(test_count, filtered_out);
        summary.write_starting_msg()?;

        if test_count > 0 {
            println!(
                "Starting Swarm with supported versions: {:?}",
                self.factory
                    .versions()
                    .map(|v| v.to_string())
                    .collect::<Vec<_>>()
            );
            let initial_version = self.initial_version();
            let genesis_version = self.genesis_version();
            let runtime = Runtime::new().unwrap();
            let mut rng = ::rand::rngs::StdRng::from_seed(OsRng.gen());
            let mut swarm = runtime.block_on(self.factory.launch_swarm(
                &mut rng,
                self.tests.initial_validator_count,
                self.tests.initial_fullnode_count,
                &initial_version,
                &genesis_version,
                self.tests.genesis_config.as_ref(),
                self.global_job_request.duration
                    + Duration::from_secs(NAMESPACE_CLEANUP_DURATION_BUFFER_SECS),
            ))?;

            // Run AptosTests
            for test in self.filter_tests(self.tests.aptos_tests.iter()) {
                let mut aptos_ctx = AptosContext::new(
                    CoreContext::from_rng(&mut rng),
                    swarm.chain_info().into_aptos_public_info(),
                    &mut report,
                );
                let result = run_test(|| runtime.block_on(test.run(&mut aptos_ctx)));
                report.report_text(result.to_string());
                summary.handle_result(test.name().to_owned(), result)?;
            }

            // Run AdminTests
            for test in self.filter_tests(self.tests.admin_tests.iter()) {
                let mut admin_ctx = AdminContext::new(
                    CoreContext::from_rng(&mut rng),
                    swarm.chain_info(),
                    &mut report,
                );
                let result = run_test(|| test.run(&mut admin_ctx));
                report.report_text(result.to_string());
                summary.handle_result(test.name().to_owned(), result)?;
            }

            for test in self.filter_tests(self.tests.network_tests.iter()) {
                let mut network_ctx = NetworkContext::new(
                    CoreContext::from_rng(&mut rng),
                    &mut *swarm,
                    &mut report,
                    self.global_job_request.clone(),
                    self.success_criteria.clone(),
                );
                let result = run_test(|| test.run(&mut network_ctx));
                report.report_text(result.to_string());
                summary.handle_result(test.name().to_owned(), result)?;
            }

            report.print_report();

            io::stdout().flush()?;
            io::stderr().flush()?;
            if !summary.success() {
                println!();
                println!("Swarm logs can be found here: {}", swarm.logs_location());
            }
        }

        summary.write_summary()?;

        if summary.success() {
            Ok(report)
        } else {
            Err(anyhow::anyhow!("Tests Failed"))
        }
    }

    fn filter_tests<'a, T: Test, I: Iterator<Item = T> + 'a>(
        &'a self,
        tests: I,
    ) -> impl Iterator<Item = T> + 'a {
        tests
            // Filter by ignored
            .filter(
                move |test| match (self.options.include_ignored, self.options.ignored) {
                    (true, _) => true, // Don't filter anything
                    (false, true) => test.ignored(),
                    (false, false) => !test.ignored(),
                },
            )
            // Filter by test name
            .filter(move |test| {
                if let Some(filter) = &self.options.filter {
                    if self.options.filter_exact {
                        test.name() == &filter[..]
                    } else {
                        test.name().contains(&filter[..])
                    }
                } else {
                    true
                }
            })
    }
}

enum TestResult {
    Ok,
    Failed,
    FailedWithMsg(String),
}

impl Display for TestResult {
    fn fmt(&self, f: &mut Formatter) -> std::fmt::Result {
        match self {
            TestResult::Ok => write!(f, "Test Ok"),
            TestResult::Failed => write!(f, "Test Failed"),
            TestResult::FailedWithMsg(msg) => write!(f, "Test Failed: {}", msg),
        }
    }
}

fn run_test<F: FnOnce() -> Result<()>>(f: F) -> TestResult {
    match ::std::panic::catch_unwind(::std::panic::AssertUnwindSafe(f)) {
        Ok(Ok(())) => TestResult::Ok,
        Ok(Err(e)) => TestResult::FailedWithMsg(format!("{:?}", e)),
        Err(_) => TestResult::Failed,
    }
}

struct TestSummary {
    stdout: StandardStream,
    total: usize,
    filtered_out: usize,
    passed: usize,
    failed: Vec<String>,
}

impl TestSummary {
    fn new(total: usize, filtered_out: usize) -> Self {
        Self {
            stdout: StandardStream::stdout(ColorChoice::Auto),
            total,
            filtered_out,
            passed: 0,
            failed: Vec::new(),
        }
    }

    fn handle_result(&mut self, name: String, result: TestResult) -> io::Result<()> {
        write!(self.stdout, "test {} ... ", name)?;
        match result {
            TestResult::Ok => {
                self.passed += 1;
                self.write_ok()?;
            }
            TestResult::Failed => {
                self.failed.push(name);
                self.write_failed()?;
            }
            TestResult::FailedWithMsg(msg) => {
                self.failed.push(name);
                self.write_failed()?;
                writeln!(self.stdout)?;

                write!(self.stdout, "Error: {}", msg)?;
            }
        }
        writeln!(self.stdout)?;
        Ok(())
    }

    fn write_ok(&mut self) -> io::Result<()> {
        self.stdout
            .set_color(ColorSpec::new().set_fg(Some(Color::Green)))?;
        write!(self.stdout, "ok")?;
        self.stdout.reset()?;
        Ok(())
    }

    fn write_failed(&mut self) -> io::Result<()> {
        self.stdout
            .set_color(ColorSpec::new().set_fg(Some(Color::Red)))?;
        write!(self.stdout, "FAILED")?;
        self.stdout.reset()?;
        Ok(())
    }

    fn write_starting_msg(&mut self) -> io::Result<()> {
        writeln!(self.stdout)?;
        writeln!(
            self.stdout,
            "running {} tests",
            self.total - self.filtered_out
        )?;
        Ok(())
    }

    fn write_summary(&mut self) -> io::Result<()> {
        // Print out the failing tests
        if !self.failed.is_empty() {
            writeln!(self.stdout)?;
            writeln!(self.stdout, "failures:")?;
            for name in &self.failed {
                writeln!(self.stdout, "    {}", name)?;
            }
        }

        writeln!(self.stdout)?;
        write!(self.stdout, "test result: ")?;
        if self.failed.is_empty() {
            self.write_ok()?;
        } else {
            self.write_failed()?;
        }
        writeln!(
            self.stdout,
            ". {} passed; {} failed; {} filtered out",
            self.passed,
            self.failed.len(),
            self.filtered_out
        )?;
        writeln!(self.stdout)?;
        Ok(())
    }

    fn success(&self) -> bool {
        self.failed.is_empty()
    }
}
