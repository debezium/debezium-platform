/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.platform.domain.views.flat.PipelineFlat;

@ExtendWith(MockitoExtension.class)
class TableNameResolverTest {

    @InjectMocks
    private TableNameResolver tableNameResolver;

    @Mock
    private PipelineFlat pipelineFlat;

    @Test
    public void testResolve_WithNullCurrentValue_ShouldReturnNull() {

        String result = tableNameResolver.resolve(pipelineFlat, null);

        assertThat(result).isNull();
    }

    @Test
    public void testResolve_WithEmptyCurrentValue_ShouldReturnEmptyString() {

        String currentValue = "";

        String result = tableNameResolver.resolve(pipelineFlat, currentValue);

        assertThat(result).isEmpty();
    }

    @Test
    public void testResolve_ShouldReplacePlaceholderWithPipelineName() {

        String currentValue = "@{pipeline_name}";
        String pipelineName = "TestPipeline";
        when(pipelineFlat.getName()).thenReturn(pipelineName);

        String result = tableNameResolver.resolve(pipelineFlat, currentValue);

        assertThat(result).isEqualTo("testpipeline");
    }

    @Test
    public void testResolve_ShouldSanitizeTableName() {

        String currentValue = "@{pipeline_name}#$%!";
        String pipelineName = "TestPipeline";
        when(pipelineFlat.getName()).thenReturn(pipelineName);

        String result = tableNameResolver.resolve(pipelineFlat, currentValue);

        assertThat(result).isEqualTo("testpipeline");
    }

    @Test
    public void testSanitizeTableName_ShouldSanitizeCorrectly() {

        String currentValue = "invalid!@name$";
        String expected = "invalid_name";
        String pipelineName = "TestPipeline";
        when(pipelineFlat.getName()).thenReturn(pipelineName);

        String result = tableNameResolver.resolve(pipelineFlat, currentValue);

        assertThat(result).isEqualTo(expected);
    }

    @Test
    public void testSanitizeTableName_ShouldTruncateTo63Bytes() {

        String longName = "a".repeat(70); // 70 characters long string
        String expected = "a".repeat(63); // 63 characters should be the max length
        String pipelineName = "TestPipeline";
        when(pipelineFlat.getName()).thenReturn(pipelineName);

        String result = tableNameResolver.resolve(pipelineFlat, longName);

        assertThat(result).isEqualTo(expected);
    }

    @Test
    public void testSanitizeTableName_ShouldPrefixWithUnderscoreIfStartsWithNonAlpha() {

        String invalidName = "123abc";
        String expected = "_123abc";
        String pipelineName = "TestPipeline";
        when(pipelineFlat.getName()).thenReturn(pipelineName);

        String result = tableNameResolver.resolve(pipelineFlat, invalidName);

        assertThat(result).isEqualTo(expected);
    }

    @Test
    public void testSanitizeTableName_ShouldRemoveConsecutiveUnderscores() {

        String nameWithConsecutiveUnderscores = "abc___def";
        String expected = "abc_def";
        String pipelineName = "TestPipeline";
        when(pipelineFlat.getName()).thenReturn(pipelineName);

        String result = tableNameResolver.resolve(pipelineFlat, nameWithConsecutiveUnderscores);

        assertThat(result).isEqualTo(expected);
    }

    @Test
    public void testSanitizeTableName_ShouldRemoveTrailingUnderscore() {

        String nameWithTrailingUnderscore = "abc_def_";
        String expected = "abc_def";
        String pipelineName = "TestPipeline";
        when(pipelineFlat.getName()).thenReturn(pipelineName);

        String result = tableNameResolver.resolve(pipelineFlat, nameWithTrailingUnderscore);

        assertThat(result).isEqualTo(expected);
    }
}
